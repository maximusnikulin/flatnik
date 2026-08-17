import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { smsConfig } from '../config/sms.config'
import { readField, SmsAeroClient, UNAVAILABLE_MESSAGE } from './smsaero.client'

const SEND_SELECTOR = 'mobile-id/send'
const STATUS_SELECTOR = 'mobile-id/status'
const VERIFY_SELECTOR = 'mobile-id/verify'

/**
 * Статусы заявки из документации провайдера (раздел «Мобильная авторизация»).
 *
 * Раньше здесь стояло «подтверждено = 2», снятое с примеров в SDK, и это была
 * не опечатка, а дыра: 2 означает ровно обратное — аутентификация не пройдена,
 * то есть вход выдавался тому, кто её провалил. Значения ниже сверены
 * с таблицей статусов в документации.
 */
export const MobileIdStatus = {
  /** Ожидает начала, заявка в очереди */
  Queued: 0,
  /** Пройдено — единственный статус, по которому можно пускать внутрь */
  Confirmed: 1,
  /** Не пройдено */
  Rejected: 2,
  /** SIM-PUSH не сработал: провайдер прислал SMS с кодом, ждём ввода */
  NeedsCode: 3,
  /** В процессе */
  InProgress: 8,
  /** Ошибка на стороне провайдера */
  Failed: 16,
} as const

/** Исход, к которому свелась заявка; промежуточные статусы — это `pending` */
export type MobileIdOutcome = 'pending' | 'needs-code' | 'confirmed' | 'failed'

/**
 * Бесплатное имя отправителя. В mobile-id подпись обязательна по схеме метода,
 * а в тестовом режиме документация прямо предписывает именно это значение.
 */
const FREE_SIGN = 'SMS Aero'

/** Сводит числовой статус провайдера к исходу, понятному входу */
export function toOutcome(status: number): MobileIdOutcome {
  switch (status) {
    case MobileIdStatus.Confirmed:
      return 'confirmed'
    case MobileIdStatus.NeedsCode:
      return 'needs-code'
    case MobileIdStatus.Rejected:
    case MobileIdStatus.Failed:
      return 'failed'
    default:
      return 'pending'
  }
}

export interface MobileIdRequest {
  /** `data.id` заявки; им же адресуются status и verify */
  requestId: string
  /** Статус, с которым заявка завелась: обычно очередь */
  status: number
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
   * Бросает вместо возврата `null`: запасного пути больше нет, и отказ провайдера
   * теперь означает, что вход не состоится. Раньше `null` включал отправку своего
   * кода в Telegram — вместе с ней исчезла и причина отвечать «не получилось»
   * молча.
   */
  async start(phone: string, callbackUrl: string): Promise<MobileIdRequest> {
    const response = await this.client.request(SEND_SELECTOR, {
      number: SmsAeroClient.toProviderNumber(phone),
      sign: this.sign,
      // Обязателен по схеме метода. Решения по нему не принимаем (см. контроллер),
      // но провайдер шлёт туда смену статуса и ждёт 200.
      callbackUrl,
    })

    if (!response.ok) {
      this.logger.error(
        `Мобильная авторизация не завелась: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
      )
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    const requestId = readField(response.data, 'id')
    if (!requestId) {
      this.logger.error('Мобильная авторизация: провайдер не вернул id заявки')
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    const status = Number(readField(response.data, 'status'))
    // Ни номера, ни кода в логе: id заявки достаточно, чтобы найти её в кабинете
    this.logger.log(`Заявка mobile-id ${requestId} создана, статус ${status}`)
    return { requestId, status }
  }

  /**
   * Спрашивает статус заявки. Это единственный источник истины о входе: webhook
   * приходит без подписи, и верить ему на слово нельзя.
   *
   * Сбой провайдера здесь не ошибка входа: человек всё ещё может подтвердить
   * вход на телефоне, поэтому недоступность превращается в «ждём» — иначе один
   * неудачный опрос ронял бы уже начатую авторизацию.
   */
  async status(requestId: string): Promise<{ outcome: MobileIdOutcome; status: number }> {
    try {
      const response = await this.client.request(STATUS_SELECTOR, { id: Number(requestId) })
      if (!response.ok) {
        this.logger.warn(
          `Статус заявки ${requestId}: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
        )
        return { outcome: 'pending', status: MobileIdStatus.InProgress }
      }
      const status = Number(readField(response.data, 'status'))
      const outcome = toOutcome(status)
      this.logger.debug(`Статус заявки ${requestId}: ${status} (${outcome})`)
      return { outcome, status }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return { outcome: 'pending', status: MobileIdStatus.InProgress }
      }
      throw error
    }
  }

  /**
   * Проверяет одноразовый код, который провайдер прислал человеку в SMS.
   * Код наш сервис не выпускает и не хранит — сверяет его SMS Aero.
   *
   * Исход читается из конверта ответа, а не из `data.status`: на живом API
   * при верном коде статус в ответе остаётся 3 («нужен OTP») и переходит в 1
   * уже асинхронно, поэтому сверка со статусом отвергала бы верный код.
   * Верный код — HTTP 200 и `success: true`, неверный — 400 `invalid otp code`.
   *
   * Отказ провайдера здесь неотличим от неверного кода, поэтому и то и другое —
   * `false`: вызывающий считает это неудачной попыткой ввода.
   */
  async verify(requestId: string, code: string): Promise<boolean> {
    const response = await this.client.request(VERIFY_SELECTOR, {
      id: Number(requestId),
      sign: this.sign,
      code,
    })

    if (!response.ok) {
      this.logger.warn(
        `Проверка заявки ${requestId}: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
      )
      return false
    }

    this.logger.log(`Заявка ${requestId}: код принят`)
    return true
  }

  /** Адрес приёмника webhook для заявки; секрет в пути аутентифицирует вызов */
  callbackUrl(secret: string): string {
    return `${this.config.publicUrl}/api/auth/mobile-id/callback/${secret}`
  }
}
