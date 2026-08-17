import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { mailConfig } from '../config/mail.config'
import { describeCause } from '../common/describe-cause'

/** Текст для пользователя: доезжает до формы, поэтому без деталей провайдера */
const UNAVAILABLE_MESSAGE = 'Не удалось отправить письмо, попробуйте ещё раз'

/**
 * Отправка писем через SMTP.
 *
 * Без заданного хоста работает вхолостую: письмо целиком уходит в лог. Это
 * тот же приём, что был у входа по SMS до перехода на мобильную авторизацию, —
 * он позволяет разрабатывать и проверять весь сценарий, не заводя ящик.
 * В production пустой хост останавливает старт (см. mail.config.ts).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  /** Создаётся лениво: без доступов транспорт не нужен вовсе */
  private transporter: Transporter | null = null

  constructor(
    @Inject(mailConfig.KEY)
    private readonly config: ConfigType<typeof mailConfig>,
  ) {}

  /** Доступы заданы — письма уходят по-настоящему; иначе печатаются в лог */
  get isEnabled(): boolean {
    return Boolean(this.config.host)
  }

  /**
   * Отправляет письмо. Бросает 503 с человеческим текстом: подтверждение почты
   * без письма не состоится, и молчаливого fail-open здесь быть не должно.
   *
   * Вызывающие, которым сбой почты не критичен (уведомление о решении
   * модератора), ловят исключение сами.
   */
  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.isEnabled) {
      // Единственный способ довести письмо до разработчика без ящика.
      // В production сюда не попадаем: пустой SMTP_HOST не даёт стартовать
      this.logger.warn(`SMTP не задан — письмо для ${to} не отправлено:\n${subject}\n${text}`)
      return
    }

    try {
      await this.transport().sendMail({ from: this.config.from, to, subject, text })
    } catch (error) {
      // Причина у nodemailer прячется в cause, как и у fetch: без неё в логе
      // остаётся только бесполезное «Error»
      this.logger.error(`SMTP не принял письмо для ${to}: ${String(error)} (${describeCause(error)})`)
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    this.logger.log(`Письмо отправлено на ${to}: ${subject}`)
  }

  private transport(): Transporter {
    this.transporter ??= createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.password },
    })
    return this.transporter
  }
}
