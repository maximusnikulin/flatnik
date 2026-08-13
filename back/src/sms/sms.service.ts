import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { smsConfig } from '../config/sms.config'
import { describeCause } from '../common/describe-cause'

/**
 * Единственный адрес отправки. Тестового режима в коде нет намеренно: sms/testsend
 * ничего не отправляет, и переключатель на него означал бы конфигурацию, при которой
 * production молча перестаёт слать SMS.
 */
const SEND_URL = 'https://gate.smsaero.ru/v2/sms/send'

const REQUEST_TIMEOUT_MS = 10_000

const UNAVAILABLE_MESSAGE = 'Не удалось отправить SMS с кодом, попробуйте ещё раз'

/** Идентификатор сообщения из `data.id` — по нему статус виден в кабинете SMS Aero */
function readMessageId(parsed: object): string {
  const data = 'data' in parsed ? parsed.data : undefined
  if (typeof data === 'object' && data !== null && 'id' in data) {
    const id = data.id
    if (typeof id === 'number' || typeof id === 'string') return String(id)
  }
  return 'без id'
}

/**
 * Разбирает ответ провайдера: `{ success, message, data }`. Схеме не доверяем —
 * сужаем руками, а на не-JSON отвечаем теми же «неуспех и нет сообщения».
 */
function readPayload(body: string): { success: boolean; message: string; messageId: string } {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        success: 'success' in parsed && parsed.success === true,
        message: 'message' in parsed && typeof parsed.message === 'string' ? parsed.message : '',
        messageId: readMessageId(parsed),
      }
    }
  } catch {
    // не JSON — вызывающий залогирует статус ответа
  }
  return { success: false, message: '', messageId: 'без id' }
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(
    @Inject(smsConfig.KEY)
    private readonly config: ConfigType<typeof smsConfig>,
  ) {}

  /** Доступы заданы — SMS уходят по-настоящему; иначе вызывающий печатает код в лог */
  get isEnabled(): boolean {
    return Boolean(this.config.apiKey && this.config.email)
  }

  /**
   * Отправляет сообщение через SMS Aero. Любая неудача — 503 с человеческим текстом:
   * он доезжает до формы, поэтому молчаливого fail-open здесь нет.
   */
  async send(phone: string, text: string): Promise<void> {
    const credentials = Buffer.from(`${this.config.email}:${this.config.apiKey}`).toString('base64')

    let response: Response
    let body: string
    try {
      response = await fetch(SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        // Провайдер ждёт номер без плюса: 79991234567
        body: JSON.stringify({ number: phone.replace(/^\+/, ''), text, sign: this.config.sign }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      body = await response.text()
    } catch (error) {
      this.logger.error(`SMS Aero недоступен: ${String(error)} (${describeCause(error)})`)
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    const payload = readPayload(body)
    if (!response.ok || !payload.success) {
      // В лог идут только статус и message провайдера: в теле успешного ответа
      // он возвращает и сам текст сообщения, то есть код подтверждения.
      this.logger.error(
        `SMS Aero отклонил отправку: ${response.status} ${payload.message || 'ответ не разобран'}`,
      )
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    // Текст в лог не идёт: в нём сам код подтверждения. По id сообщение
    // находится в кабинете SMS Aero вместе со статусом доставки.
    this.logger.log(`SMS отправлена на ${phone} (${payload.messageId})`)
  }
}
