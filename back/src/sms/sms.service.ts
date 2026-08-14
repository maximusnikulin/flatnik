import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { readField, SmsAeroClient, UNAVAILABLE_MESSAGE } from './smsaero.client'

/**
 * Запасной путь входа: код придумываем мы и отправляем его в Telegram по номеру
 * телефона. Основной путь — «мобильная авторизация» (MobileIdService); сюда
 * попадаем, когда она для номера недоступна.
 *
 * Обычный sms/send здесь не годится: с бесплатным именем отправителя операторы
 * отклоняют сообщения с кодами (status reject), да и стоит SMS в разы дороже.
 * Тестового режима в коде нет намеренно — переключатель на него означал бы
 * конфигурацию, при которой production молча перестаёт отправлять коды.
 */
const SEND_SELECTOR = 'telegram/send'

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(private readonly client: SmsAeroClient) {}

  /** Доступы заданы — коды уходят по-настоящему; иначе вызывающий печатает код в лог */
  get isEnabled(): boolean {
    return this.client.isEnabled
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
    const response = await this.client.request(SEND_SELECTOR, {
      number: SmsAeroClient.toProviderNumber(phone),
      // Код числом, как в схеме провайдера; ведущих нулей в нём нет по построению
      code: Number(code),
      ...(this.client.sign ? { text: smsText, sign: this.client.sign } : {}),
    })

    if (!response.ok) {
      // В лог идут только статус и message провайдера: в теле успешного ответа
      // он возвращает и сам текст сообщения, то есть код подтверждения.
      this.logger.error(
        `SMS Aero отклонил отправку: ${response.httpStatus} ${response.message || 'ответ не разобран'}`,
      )
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    // Сам код в лог не идёт. По id сообщение находится в кабинете SMS Aero —
    // там же виден и статус доставки: принят провайдером ≠ доставлен.
    const channel = this.client.sign ? 'Telegram с каскадом в SMS' : 'Telegram'
    const messageId = readField(response.data, 'id') || 'без id'
    this.logger.log(`Код отправлен на ${phone} — ${channel} (id ${messageId})`)
  }
}
