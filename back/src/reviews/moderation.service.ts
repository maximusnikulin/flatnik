import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TelegramClient, escapeHtml } from '../telegram/telegram.client'
import { MailService } from '../mail/mail.service'
import { UsersService } from '../users/users.service'
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

/** Те же границы, что у CreateReviewDto / UpdateReviewDto и textarea формы */
const TEXT_MIN_LENGTH = 10
const TEXT_MAX_LENGTH = 3000

/** Лимит Bot API на editMessageText; карточка + вердикт + новый текст могут не влезть */
const CARD_LIMIT = 4096

/** Отзыв, ждущий ответа модератора: причина отклонения или отредактированный текст */
interface AwaitedReply {
  reviewId: string
  /** Карточка отзыва — её перепишем, когда ответ придёт */
  cardMessageId: number
  cardText: string
  kind: 'reject' | 'edit'
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Карточка + вердикт + новый текст; обрезаем, если не влезает в лимит Bot API */
function closeCardWithEdit(cardText: string, editedText: string): string {
  const verdict = '✏️ <b>Отредактирован и опубликован</b>'
  const prefix = `${escapeHtml(cardText)}\n\n${verdict}\n\n`
  const escaped = escapeHtml(editedText)
  const room = CARD_LIMIT - prefix.length
  if (room <= 1) {
    return `${escapeHtml(cardText)}\n\n${verdict}`.slice(0, CARD_LIMIT)
  }
  const body = escaped.length > room ? `${escaped.slice(0, room - 1)}…` : escaped
  return `${prefix}${body}`
}

/**
 * Модерация отзывов из телеграм-бота: карточка с кнопками «Одобрить» /
 * «Отклонить» / «Редактировать». Отклонение и правка — ответным сообщением.
 *
 * Со статусами работает через репозиторий, а не через ReviewsService: так
 * зависимость односторонняя (ReviewsService → ModerationService) и цикла в DI нет.
 */
@Injectable()
export class ModerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModerationService.name)

  /**
   * message_id вопроса («причина?» / «новый текст?») → отзыв, который его ждёт.
   * Живёт в памяти, как коды входа в AuthService: рестарт контейнера теряет
   * ожидание, и модератор просто нажимает кнопку ещё раз.
   */
  private readonly awaitedReplies = new Map<number, AwaitedReply>()

  private offset = 0
  private isStopped = false
  private polling: Promise<void> | null = null

  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly telegram: TelegramClient,
    private readonly mail: MailService,
    private readonly users: UsersService,
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
   * Отправляет модератору карточку отзыва в Telegram и письмо на support@flatnik.ru.
   * Не бросает: отзыв уже сохранён, и сбой любого канала не повод отвечать
   * пользователю ошибкой — отзыв останется в очереди (/pending) и письмо независимо.
   */
  async notify(reviewId: string, isRepeat = false): Promise<void> {
    const review = await this.loadWithContext(reviewId)
    if (!review) {
      this.logger.error(`Отзыв ${reviewId} не найден — уведомления не отправлены`)
      return
    }

    if (this.telegram.isEnabled) {
      await this.telegram.sendMessage(
        this.telegram.moderatorChatId,
        buildReviewCard(review, isRepeat),
        buildModerationKeyboard(review.id),
      )
    }

    await this.notifyByEmail(review, isRepeat)
  }

  /**
   * Письмо модератору о новом отзыве на support@flatnik.ru.
   * Не бросает — по той же логике, что `notify` для Telegram.
   */
  private async notifyByEmail(review: Review, isRepeat: boolean): Promise<void> {
    const label = isRepeat ? 'исправлен' : 'новый'
    const subject = `Отзыв на модерацию (${label}): ${review.id}`
    const body = [
      isRepeat
        ? 'Автор исправил отзыв и отправил его на проверку заново.'
        : 'Новый отзыв ожидает модерации.',
      '',
      `ID: ${review.id}`,
      `Адрес: ${review.apartment.house.address}`,
      `Кв. ${review.apartment.number}, подъезд ${review.apartment.entrance}`,
      `Автор: ${review.author.nickname}`,
      '',
      review.text,
    ].join('\n')

    try {
      await this.mail.send('support@flatnik.ru', subject, body)
    } catch (error) {
      this.logger.error(`Отзыв ${review.id}: не удалось отправить email уведомление: ${String(error)}`)
    }
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
      await this.askReply(query, message, reviewId, 'reject')
      return
    }

    if (action === 'edit') {
      await this.askReply(query, message, reviewId, 'edit')
      return
    }

    await this.telegram.answerCallbackQuery(query.id, 'Неизвестная кнопка')
  }

  /** Просит модератора ответить на сообщение: причина отклонения или новый текст */
  private async askReply(
    query: TelegramCallbackQuery,
    message: TelegramMessage,
    reviewId: string,
    kind: AwaitedReply['kind'],
  ): Promise<void> {
    const prompt =
      kind === 'reject'
        ? 'Причина отклонения? Ответьте на это сообщение — текст увидит автор отзыва.'
        : 'Отредактированный текст? Ответьте на это сообщение — он заменит отзыв и сразу опубликуется.'
    const questionId = await this.telegram.sendMessage(this.telegram.moderatorChatId, prompt, {
      force_reply: true,
    })
    if (questionId !== null) {
      this.awaitedReplies.set(questionId, {
        reviewId,
        cardMessageId: message.message_id,
        cardText: message.text ?? '',
        kind,
      })
    }
    await this.telegram.answerCallbackQuery(query.id, kind === 'reject' ? 'Жду причину' : 'Жду текст')
  }

  /** Ответ с причиной отклонения, отредактированным текстом или команда */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    if (!this.isModerator(message)) {
      // Единственный способ узнать свой chat id при настройке бота
      this.logger.warn(`Сообщение из чужого чата ${message.chat.id} проигнорировано`)
      return
    }

    const replyTo = message.reply_to_message?.message_id
    const awaited = replyTo === undefined ? undefined : this.awaitedReplies.get(replyTo)
    if (replyTo !== undefined && awaited && message.text) {
      if (awaited.kind === 'edit') {
        await this.handleEditReply(replyTo, awaited, message.text)
        return
      }
      this.awaitedReplies.delete(replyTo)
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
        'Бот модерации Квартирника. Новые отзывы приходят сюда сами, /pending — те, что ждут решения.',
      )
    }
  }

  /**
   * Новый текст вместо авторского: те же границы, что у формы. Невалидный
   * ответ не снимает ожидание — модератор отвечает на тот же вопрос ещё раз.
   */
  private async handleEditReply(
    questionId: number,
    awaited: AwaitedReply,
    rawText: string,
  ): Promise<void> {
    const text = rawText.trim()
    if (text.length < TEXT_MIN_LENGTH || text.length > TEXT_MAX_LENGTH) {
      await this.telegram.sendMessage(
        this.telegram.moderatorChatId,
        `Текст должен быть от ${TEXT_MIN_LENGTH} до ${TEXT_MAX_LENGTH} символов. Ответьте на тот же вопрос ещё раз.`,
      )
      return
    }

    this.awaitedReplies.delete(questionId)
    const review = await this.applyAdminEdit(awaited.reviewId, text)
    if (!review) {
      await this.telegram.sendMessage(this.telegram.moderatorChatId, 'Отзыв не найден')
      return
    }
    await this.telegram.editMessageText(
      this.telegram.moderatorChatId,
      awaited.cardMessageId,
      closeCardWithEdit(awaited.cardText, text),
    )
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
    await this.mailVerdict(review)
    return review
  }

  /** Заменяет текст, помечает правку модератора и сразу публикует */
  private async applyAdminEdit(reviewId: string, text: string): Promise<Review | null> {
    const review = await this.reviews.findOneBy({ id: reviewId })
    if (!review) {
      return null
    }

    review.text = text
    review.editedByAdmin = true
    review.status = ReviewStatus.Confirmed
    review.rejectionReason = null
    await this.reviews.save(review)
    this.logger.log(`Отзыв ${reviewId}: отредактирован модератором и опубликован`)
    await this.mailVerdict(review)
    return review
  }

  /**
   * Сообщает автору решение письмом. Не бросает: решение модератора уже
   * сохранено, и недоступный SMTP не повод отвечать боту ошибкой — тот же
   * принцип, что и у `notify` с недоступным телеграмом.
   */
  private async mailVerdict(review: Review): Promise<void> {
    const author = await this.users.findById(review.authorId)
    if (!author?.email) {
      // Почта обязательна для новых отзывов, но у заведённых раньше её нет
      this.logger.warn(`Отзыв ${review.id}: у автора нет почты, решение не отправлено`)
      return
    }

    const approved = review.status === ReviewStatus.Confirmed
    const subject = approved ? 'Ваш отзыв опубликован' : 'Ваш отзыв отклонён'
    const body = approved
      ? review.editedByAdmin
        ? 'Модератор опубликовал ваш отзыв с редакторскими правками — он доступен на Квартирнике.'
        : 'Модератор одобрил ваш отзыв — он опубликован на Квартирнике.'
      : `Модератор отклонил ваш отзыв.\n\nПричина: ${review.rejectionReason ?? 'не указана'}\n\nОтзыв можно поправить и отправить на проверку заново.`

    try {
      await this.mail.send(author.email, subject, body)
    } catch (error) {
      this.logger.error(`Отзыв ${review.id}: не удалось отправить решение автору: ${String(error)}`)
    }
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
