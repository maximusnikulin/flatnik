import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { telegramConfig } from '../config/telegram.config'
import { describeCause } from '../common/describe-cause'
import type { TelegramReplyMarkup, TelegramUpdate } from './telegram.types'

const API_ROOT = 'https://api.telegram.org'

/** Сколько Telegram держит запрос getUpdates открытым, ожидая событие */
const POLL_TIMEOUT_S = 30

/** Запас поверх long polling: сеть должна успеть отдать пустой ответ */
const POLL_ABORT_MS = (POLL_TIMEOUT_S + 10) * 1000

const REQUEST_TIMEOUT_MS = 10_000

/** Лимит сообщения — 4096 символов; оставляем место под шапку карточки */
export const MESSAGE_LIMIT = 3500

/** Экранирует пользовательский текст для parse_mode: HTML */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Тонкая обёртка над Bot API на голом fetch — как CaptchaService и SmsAeroClient,
 * отдельный SDK ради четырёх методов не нужен.
 *
 * Ни один метод не бросает: сбой телеграма не должен ронять создание отзыва,
 * ради которого клиент и вызывается. Неудача — запись в лог и null/false.
 */
@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name)

  /** Прерывает висящий getUpdates при остановке приложения */
  private pollController: AbortController | null = null

  constructor(
    @Inject(telegramConfig.KEY)
    private readonly config: ConfigType<typeof telegramConfig>,
  ) {}

  /** Токен и чат модератора заданы — бота можно запускать */
  get isEnabled(): boolean {
    return Boolean(this.config.botToken && this.config.moderatorChatId)
  }

  get moderatorChatId(): string {
    return this.config.moderatorChatId
  }

  /** Отправляет сообщение; возвращает его message_id или null при сбое */
  async sendMessage(
    chatId: string,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
  ): Promise<number | null> {
    const result = await this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    })
    if (result === null || typeof result !== 'object' || !('message_id' in result)) {
      return null
    }
    const messageId = result.message_id
    return typeof messageId === 'number' ? messageId : null
  }

  /** Переписывает отправленное сообщение и убирает из-под него клавиатуру */
  async editMessageText(chatId: string, messageId: number, text: string): Promise<void> {
    await this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    })
  }

  /** Гасит «часики» на нажатой кнопке; без этого клиент считает бота зависшим */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
  }

  /** Пачка событий начиная с offset; null — запрос не удался, вызывающий ждёт и повторяет */
  async getUpdates(offset: number): Promise<TelegramUpdate[] | null> {
    const result = await this.call(
      'getUpdates',
      {
        offset,
        timeout: POLL_TIMEOUT_S,
        allowed_updates: ['message', 'callback_query'],
      },
      true,
    )
    if (!Array.isArray(result)) {
      return null
    }
    // Схема Bot API фиксирована; берём из неё только поля telegram.types.ts
    return result as TelegramUpdate[]
  }

  /** Обрывает висящий long polling, чтобы контейнер не ждал его 30 секунд */
  abortPolling(): void {
    this.pollController?.abort()
  }

  /**
   * Один вызов Bot API. `polling` меняет таймаут и помечает запрос прерываемым:
   * getUpdates по своей природе висит дольше обычного запроса.
   */
  private async call(
    method: string,
    payload: Record<string, unknown>,
    polling = false,
  ): Promise<unknown> {
    const controller = new AbortController()
    if (polling) {
      this.pollController = controller
    }
    const timer = setTimeout(
      () => controller.abort(),
      polling ? POLL_ABORT_MS : REQUEST_TIMEOUT_MS,
    )

    try {
      const response = await fetch(`${API_ROOT}/bot${this.config.botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const parsed: unknown = await response.json()
      if (!response.ok || typeof parsed !== 'object' || parsed === null || !('ok' in parsed)) {
        // description телеграма объясняет причину точнее статуса: неверный токен,
        // чужой чат, второй процесс с тем же токеном (409)
        this.logger.error(`Bot API отклонил ${method}: ${response.status} ${JSON.stringify(parsed)}`)
        return null
      }
      return 'result' in parsed ? parsed.result : null
    } catch (error) {
      if (controller.signal.aborted && polling) {
        // Ожидаемо при остановке приложения и при затянувшемся long polling
        return null
      }
      this.logger.error(`Bot API недоступен (${method}): ${String(error)} (${describeCause(error)})`)
      return null
    } finally {
      clearTimeout(timer)
      if (polling) {
        this.pollController = null
      }
    }
  }
}
