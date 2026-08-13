import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TelegramClient, escapeHtml } from '../telegram/telegram.client'
import type {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from '../telegram/telegram.types'
import { Review } from './review.entity'
import { ReviewStatus } from './review-status'
import { buildModerationKeyboard, buildReviewCard } from './review-message'

/** Пауза после неудачного getUpdates, чтобы цикл не крутился вхолостую */
const RETRY_DELAY_MS = 5000

/** Сколько отзывов показывает /pending за раз */
const PENDING_PAGE_SIZE = 10

/** Отзыв, ждущий причины отклонения: ответ модератора прилетит отдельным сообщением */
interface AwaitedRejection {
  reviewId: string
  /** Карточка отзыва — её перепишем, когда причина придёт */
  cardMessageId: number
  cardText: string
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Модерация отзывов из телеграм-бота: карточка с кнопками «Одобрить» /
 * «Отклонить», причина отклонения ответным сообщением.
 *
 * Со статусами работает через репозиторий, а не через ReviewsService: так
 * зависимость односторонняя (ReviewsService → ModerationService) и цикла в DI нет.
 */
@Injectable()
export class ModerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModerationService.name)

  /**
   * message_id вопроса «причина?» → отзыв, который её ждёт. Живёт в памяти, как
   * коды входа в AuthService: рестарт контейнера теряет ожидание, и модератор
   * просто нажимает «Отклонить» ещё раз.
   */
  private readonly awaitedRejections = new Map<number, AwaitedRejection>()

  private offset = 0
  private isStopped = false
  private polling: Promise<void> | null = null

  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly telegram: TelegramClient,
  ) {}

  onModuleInit(): void {
    if (!this.telegram.isEnabled) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN или TELEGRAM_MODERATOR_CHAT_ID не заданы — модерация из бота выключена',
      )
      return
    }
    this.polling = this.poll()
  }

  async onModuleDestroy(): Promise<void> {
    this.isStopped = true
    this.telegram.abortPolling()
    await this.polling
  }

  /**
   * Отправляет модератору карточку отзыва. Не бросает: отзыв уже сохранён, и
   * недоступный телеграм не повод отвечать пользователю ошибкой — отзыв
   * останется в очереди и найдётся командой /pending.
   */
  async notify(reviewId: string, isRepeat = false): Promise<void> {
    if (!this.telegram.isEnabled) {
      return
    }

    const review = await this.loadWithContext(reviewId)
    if (!review) {
      this.logger.error(`Отзыв ${reviewId} не найден — карточка модератору не отправлена`)
      return
    }

    await this.telegram.sendMessage(
      this.telegram.moderatorChatId,
      buildReviewCard(review, isRepeat),
      buildModerationKeyboard(review.id),
    )
  }

  /** Цикл long polling; ошибки внутри не выпускаем наружу, иначе цикл оборвётся */
  private async poll(): Promise<void> {
    this.logger.log('Телеграм-бот модерации запущен')

    while (!this.isStopped) {
      const updates = await this.telegram.getUpdates(this.offset)
      if (updates === null) {
        if (!this.isStopped) {
          await delay(RETRY_DELAY_MS)
        }
        continue
      }

      for (const update of updates) {
        // Сдвигаем offset до обработки: событие, на котором бот споткнулся,
        // не должно приходить снова и снова
        this.offset = update.update_id + 1
        try {
          await this.handle(update)
        } catch (error) {
          this.logger.error(`Не удалось обработать событие ${update.update_id}: ${String(error)}`)
        }
      }
    }

    this.logger.log('Телеграм-бот модерации остановлен')
  }

  private async handle(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update.callback_query)
      return
    }
    if (update.message) {
      await this.handleMessage(update.message)
    }
  }

  /** Нажата кнопка под карточкой */
  private async handleCallback(query: TelegramCallbackQuery): Promise<void> {
    const message = query.message
    if (!message || !this.isModerator(message)) {
      await this.telegram.answerCallbackQuery(query.id, 'Чат не является чатом модератора')
      return
    }

    const [action, reviewId] = (query.data ?? '').split(':')

    if (action === 'approve') {
      const review = await this.setStatus(reviewId, ReviewStatus.Confirmed, null)
      await this.telegram.answerCallbackQuery(query.id, review ? 'Одобрен' : 'Отзыв не найден')
      if (review) {
        await this.closeCard(message, '✅ <b>Одобрен</b>')
      }
      return
    }

    if (action === 'reject') {
      const questionId = await this.telegram.sendMessage(
        this.telegram.moderatorChatId,
        'Причина отклонения? Ответьте на это сообщение — текст увидит автор отзыва.',
        { force_reply: true },
      )
      if (questionId !== null) {
        this.awaitedRejections.set(questionId, {
          reviewId,
          cardMessageId: message.message_id,
          cardText: message.text ?? '',
        })
      }
      await this.telegram.answerCallbackQuery(query.id, 'Жду причину')
      return
    }

    await this.telegram.answerCallbackQuery(query.id, 'Неизвестная кнопка')
  }

  /** Ответ с причиной отклонения или команда */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    if (!this.isModerator(message)) {
      // Единственный способ узнать свой chat id при настройке бота
      this.logger.warn(`Сообщение из чужого чата ${message.chat.id} проигнорировано`)
      return
    }

    const replyTo = message.reply_to_message?.message_id
    const awaited = replyTo === undefined ? undefined : this.awaitedRejections.get(replyTo)
    if (replyTo !== undefined && awaited && message.text) {
      this.awaitedRejections.delete(replyTo)
      const review = await this.setStatus(awaited.reviewId, ReviewStatus.Rejected, message.text)
      if (!review) {
        await this.telegram.sendMessage(this.telegram.moderatorChatId, 'Отзыв не найден')
        return
      }
      await this.telegram.editMessageText(
        this.telegram.moderatorChatId,
        awaited.cardMessageId,
        `${escapeHtml(awaited.cardText)}\n\n❌ <b>Отклонён:</b> ${escapeHtml(message.text)}`,
      )
      return
    }

    const command = message.text?.trim()
    if (command === '/pending') {
      await this.sendPending()
      return
    }
    if (command === '/start') {
      await this.telegram.sendMessage(
        this.telegram.moderatorChatId,
        'Бот модерации flatnik. Новые отзывы приходят сюда сами, /pending — те, что ждут решения.',
      )
    }
  }

  /**
   * Отзывы, ждущие решения. Нужна потому, что уведомления теряются, пока бот
   * выключен или контейнер лежит: другого способа найти их нет.
   */
  private async sendPending(): Promise<void> {
    const reviews = await this.reviews.find({
      where: { status: ReviewStatus.Pending },
      relations: { apartment: { house: true }, author: true },
      order: { createdAt: 'ASC' },
      take: PENDING_PAGE_SIZE,
    })

    if (reviews.length === 0) {
      await this.telegram.sendMessage(this.telegram.moderatorChatId, 'Неотмодерированных отзывов нет')
      return
    }

    for (const review of reviews) {
      await this.telegram.sendMessage(
        this.telegram.moderatorChatId,
        buildReviewCard(review, review.rejectionReason !== null),
        buildModerationKeyboard(review.id),
      )
    }
  }

  /** Дописывает решение в карточку и убирает из-под неё кнопки */
  private async closeCard(card: TelegramMessage, verdict: string): Promise<void> {
    // В message.text приходит уже отрисованный текст без разметки — возвращаем
    // его в HTML экранированием, иначе адрес со скобками поедет
    await this.telegram.editMessageText(
      this.telegram.moderatorChatId,
      card.message_id,
      `${escapeHtml(card.text ?? '')}\n\n${verdict}`,
    )
  }

  private async setStatus(
    reviewId: string | undefined,
    status: ReviewStatus,
    rejectionReason: string | null,
  ): Promise<Review | null> {
    if (!reviewId) {
      return null
    }
    const review = await this.reviews.findOneBy({ id: reviewId })
    if (!review) {
      return null
    }

    review.status = status
    review.rejectionReason = rejectionReason
    await this.reviews.save(review)
    this.logger.log(`Отзыв ${reviewId}: статус ${status}`)
    return review
  }

  private isModerator(message: TelegramMessage): boolean {
    return String(message.chat.id) === this.telegram.moderatorChatId
  }

  private loadWithContext(reviewId: string): Promise<Review | null> {
    return this.reviews.findOne({
      where: { id: reviewId },
      relations: { apartment: { house: true }, author: true },
    })
  }
}
