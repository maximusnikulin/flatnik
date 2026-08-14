import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { smsConfig } from '../config/sms.config'
import { readField, SmsAeroClient } from './smsaero.client'

const SEND_SELECTOR = 'mobile-id/send'
const STATUS_SELECTOR = 'mobile-id/status'
const VERIFY_SELECTOR = 'mobile-id/verify'

/**
 * Статус заявки, означающий подтверждение. Значения сняты с примеров ответов
 * в официальном SDK провайдера: 0 — заявка создана, 1 — промежуточный,
 * 2 — подтверждена. Каждый ответ логируется статусом, поэтому расхождение
 * с реальностью видно в логе на первом же входе.
 */
const CONFIRMED_STATUS = 2

/** Подтверждение прямо на SIM-карте: вводить нечего, результат узнаём опросом */
const SIM_PUSH = 'SIM-PUSH'

/** Бесплатное имя отправителя; в mobile-id подпись обязательна по схеме метода */
const FREE_SIGN = 'SMS Aero'

export interface MobileIdRequest {
  requestId: string
  authType: string
  /** Человеку пришёл код и его надо ввести; иначе он подтверждает вход на телефоне */
  needsCode: boolean
}

@Injectable()
export class MobileIdService {
  private readonly logger = new Logger(MobileIdService.name)

  constructor(
    private readonly client: SmsAeroClient,
    @Inject(smsConfig.KEY)
    private readonly config: ConfigType<typeof smsConfig>,
  ) {}

  private get sign(): string {
    return this.client.sign || FREE_SIGN
  }

  /**
   * Заводит заявку на мобильную авторизацию.
   *
   * `null` вместо исключения — это штатный ответ «для этого номера не получилось»:
   * mobile-id поддержан не у всех операторов, и отказ провайдера должен включать
   * запасной путь с кодом, а не закрывать вход. Исключение остаётся только на
   * сетевом сбое — там решать нечего (см. SmsAeroClient.request).
   */
  async start(phone: string): Promise<MobileIdRequest | null> {
    if (!this.client.isEnabled) return null

    const response = await this.client.request(SEND_SELECTOR, {
      number: SmsAeroClient.toProviderNumber(phone),
      sign: this.sign,
      // Результат мы узнаём опросом статуса, но поле обязательно по схеме метода.
      // Приёмник только пишет в лог — он полезен для диагностики и избавляет
      // провайдера от стука в 404.
      callbackUrl: `${this.config.publicUrl}/api/auth/mobile-id/callback`,
    })

    if (!response.ok) {
      this.logger.warn(
        `Мобильная авторизация недоступна: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
      )
      return null
    }

    const requestId = readField(response.data, 'id')
    if (!requestId) {
      this.logger.warn('Мобильная авторизация: провайдер не вернул id заявки')
      return null
    }

    const authType = readField(response.data, 'authType')
    const codeSms = readField(response.data, 'codeSms')
    const needsCode = authType !== SIM_PUSH || codeSms !== ''

    // Ни номера, ни кода в логе: id заявки достаточно, чтобы найти её в кабинете
    this.logger.log(
      `Заявка mobile-id ${requestId}: ${authType || 'тип не указан'}, ` +
        `${needsCode ? 'нужен ввод кода' : 'подтверждение на телефоне'}`,
    )
    return { requestId, authType, needsCode }
  }

  /**
   * Статус заявки. Сбой провайдера здесь не ошибка входа: человек всё ещё может
   * подтвердить вход на телефоне, поэтому недоступность превращается в «ждём» —
   * иначе один неудачный опрос ронял бы уже начатую авторизацию.
   */
  async status(requestId: string): Promise<{ confirmed: boolean }> {
    try {
      const response = await this.client.request(STATUS_SELECTOR, { id: Number(requestId) })
      if (!response.ok) {
        this.logger.warn(
          `Статус заявки ${requestId}: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
        )
        return { confirmed: false }
      }
      const status = Number(readField(response.data, 'status'))
      this.logger.debug(`Статус заявки ${requestId}: ${status}`)
      return { confirmed: status === CONFIRMED_STATUS }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return { confirmed: false }
      throw error
    }
  }

  /**
   * Проверяет код, который провайдер прислал человеку. Отказ провайдера здесь
   * неотличим от неверного кода, поэтому и то и другое — `false`: вызывающий
   * считает это неудачной попыткой ввода.
   */
  async verify(requestId: string, code: string): Promise<boolean> {
    const response = await this.client.request(VERIFY_SELECTOR, {
      id: Number(requestId),
      code,
      sign: this.sign,
    })

    if (!response.ok) {
      this.logger.warn(
        `Проверка заявки ${requestId}: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
      )
      return false
    }

    const status = Number(readField(response.data, 'status'))
    return status === CONFIRMED_STATUS
  }
}
