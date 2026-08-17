import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { smsConfig } from '../config/sms.config'
import { describeCause } from '../common/describe-cause'

/** Гейт API SMS Aero; у провайдера есть зеркала (.org, .net), но здесь одно основное */
const GATE_URL = 'https://gate.smsaero.ru/v2/'

const REQUEST_TIMEOUT_MS = 10_000

/** Текст для пользователя: доезжает до формы, поэтому без деталей провайдера */
export const UNAVAILABLE_MESSAGE = 'Не удалось отправить код, попробуйте ещё раз'

/**
 * Ответ провайдера. `ok` — успех и по HTTP, и по конверту: SMS Aero отвечает 200
 * с `success: false`, поэтому одного статуса мало.
 */
export interface SmsAeroResponse {
  ok: boolean
  httpStatus: number
  message: string
  data: Record<string, unknown>
}

/** Сужает `data` до объекта: схеме провайдера не доверяем */
function readData(parsed: unknown): Record<string, unknown> {
  if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
    const { data } = parsed as { data: unknown }
    if (typeof data === 'object' && data !== null) return data as Record<string, unknown>
  }
  return {}
}

/** Разбирает конверт `{ success, message, data }`; не-JSON = неуспех без сообщения */
function readPayload(body: string): { success: boolean; message: string; data: Record<string, unknown> } {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        success: 'success' in parsed && parsed.success === true,
        message: 'message' in parsed && typeof parsed.message === 'string' ? parsed.message : '',
        data: readData(parsed),
      }
    }
  } catch {
    // не JSON — вызывающий залогирует HTTP-статус
  }
  return { success: false, message: '', data: {} }
}

/** Поле `data` числом или строкой — к строке; всё остальное к пустой строке */
export function readField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return ''
}

/**
 * Транспорт к API SMS Aero: авторизация, таймаут и разбор конверта — общие для
 * всех методов провайдера. Решение, что делать с отказом, остаётся вызывающему:
 * для отправки кода это 503, а для «мобильной авторизации» — откат на код,
 * поэтому клиент бросает исключение только на сетевом сбое, когда решать нечего.
 */
@Injectable()
export class SmsAeroClient {
  private readonly logger = new Logger(SmsAeroClient.name)

  constructor(
    @Inject(smsConfig.KEY)
    private readonly config: ConfigType<typeof smsConfig>,
  ) {}

  /** Доступы заданы — запросы уходят по-настоящему; иначе вызывающий работает без провайдера */
  get isEnabled(): boolean {
    return Boolean(this.config.apiKey && this.config.email)
  }

  /**
   * Имя отправителя. Пустое `SMSAERO_SIGN` — не ошибка: бесплатное «SMS Aero»
   * годится там, где подпись обязательна по схеме метода, и не годится для SMS
   * с кодом (операторы такие отклоняют).
   */
  get sign(): string {
    return this.config.sign
  }

  /** Провайдер ждёт номер без плюса: +79001234567 → 79001234567 */
  static toProviderNumber(phone: string): string {
    return phone.replace(/^\+/, '')
  }

  async request(selector: string, payload: Record<string, unknown>): Promise<SmsAeroResponse> {
    const credentials = Buffer.from(`${this.config.email}:${this.config.apiKey}`).toString('base64')

    let response: Response
    let body: string
    try {
      response = await fetch(`${GATE_URL}${selector}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      body = await response.text()
    } catch (error) {
      // Причина у fetch спрятана в cause: без неё в логе только «fetch failed»
      this.logger.error(`SMS Aero недоступен (${selector}): ${String(error)} (${describeCause(error)})`)
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    const parsed = readPayload(body)
    return {
      ok: response.ok && parsed.success,
      httpStatus: response.status,
      message: parsed.message,
      data: parsed.data,
    }
  }
}
