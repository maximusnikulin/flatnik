import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { smsConfig } from '../config/sms.config'
import { describeCause } from '../common/describe-cause'

/**
 * Код уходит в Telegram по номеру телефона. Обычный sms/send здесь не годится:
 * с бесплатным именем отправителя операторы отклоняют сообщения с кодами
 * (status reject), да и стоит SMS в разы дороже. Тестового режима в коде нет
 * намеренно — переключатель на него означал бы конфигурацию, при которой
 * production молча перестаёт отправлять коды.
 */
const SEND_URL = 'https://gate.smsaero.ru/v2/telegram/send'

const REQUEST_TIMEOUT_MS = 10_000

const UNAVAILABLE_MESSAGE = 'Не удалось отправить код, попробуйте ещё раз'

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

  /** Доступы заданы — коды уходят по-настоящему; иначе вызывающий печатает код в лог */
  get isEnabled(): boolean {
    return Boolean(this.config.apiKey && this.config.email)
  }

  /**
   * Отправляет код в Telegram на номер телефона. Если задано своё имя отправителя,
   * провайдер включает каскад: не доставили в Telegram — уйдёт SMS с текстом
   * `smsText`. С бесплатным именем каскад выключен намеренно, такие SMS всё равно
   * отклоняются операторами, а деньги за попытку списываются.
   *
   * Любая неудача — 503 с человеческим текстом: он доезжает до формы,
   * поэтому молчаливого fail-open здесь нет.
   */
  async sendCode(phone: string, code: string, smsText: string): Promise<void> {
    const credentials = Buffer.from(`${this.config.email}:${this.config.apiKey}`).toString('base64')

    const payloadToSend = {
      // Провайдер ждёт номер без плюса: 79991234567
      number: phone.replace(/^\+/, ''),
      // Код числом, как в схеме провайдера; ведущих нулей в нём нет по построению
      code: Number(code),
      ...(this.config.sign ? { text: smsText, sign: this.config.sign } : {}),
    }

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
        body: JSON.stringify(payloadToSend),
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

    // Сам код в лог не идёт. По id сообщение находится в кабинете SMS Aero —
    // там же виден и статус доставки: принят провайдером ≠ доставлен.
    const channel = this.config.sign ? 'Telegram с каскадом в SMS' : 'Telegram'
    this.logger.log(`Код отправлен на ${phone} — ${channel} (id ${payload.messageId})`)
  }
}
