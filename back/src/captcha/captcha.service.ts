import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { captchaConfig } from '../config/captcha.config'
import { describeCause } from '../common/describe-cause'

const VALIDATE_URL = 'https://smartcaptcha.yandexcloud.net/validate'

const UNAVAILABLE_MESSAGE = 'Проверка капчи временно недоступна, попробуйте ещё раз'

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name)

  constructor(
    @Inject(captchaConfig.KEY)
    private readonly config: ConfigType<typeof captchaConfig>,
  ) {}

  /**
   * Проверяет токен Yandex SmartCaptcha.
   * Без серверного ключа проверка выключена — только в разработке: в production
   * приложение с пустым ключом не стартует (см. captcha.config.ts).
   *
   * Fail-open отменён осознанно: пропуская запрос при сбое проверки, сервис ведёт
   * себя ровно как сервис без капчи, и сломанные ключи или недоступность Яндекса
   * не видны ни пользователю, ни разработчику. Сбой = 503 и предложение повторить.
   */
  async validate(token: string | undefined, ip?: string): Promise<void> {
    if (!this.config.serverKey) {
      this.logger.warn('SMARTCAPTCHA_SERVER_KEY не задан — проверка капчи пропущена')
      return
    }
    if (!token) {
      throw new BadRequestException('Не передан токен капчи')
    }

    const body = new URLSearchParams({ secret: this.config.serverKey, token })
    if (ip) {
      body.set('ip', ip)
    }

    let status: string
    try {
      const response = await fetch(VALIDATE_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) {
        // Чаще всего это неверный серверный ключ — единственный след в логе
        this.logger.error(`Сервис капчи ответил ${response.status}`)
        throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
      }
      const payload: unknown = await response.json()
      status =
        typeof payload === 'object' &&
        payload !== null &&
        'status' in payload &&
        typeof payload.status === 'string'
          ? payload.status
          : 'unknown'
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error      
      this.logger.error(`Сервис капчи недоступен: ${String(error)} (${describeCause(error)})`)
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE)
    }

    if (status !== 'ok') {
      throw new ForbiddenException('Проверка капчи не пройдена')
    }
  }
}
