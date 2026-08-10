import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { captchaConfig } from '../config/captcha.config'

const VALIDATE_URL = 'https://smartcaptcha.yandexcloud.net/validate'

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name)

  constructor(
    @Inject(captchaConfig.KEY)
    private readonly config: ConfigType<typeof captchaConfig>,
  ) {}

  /**
   * Проверяет токен Yandex SmartCaptcha.
   * Без серверного ключа проверка выключена (режим разработки).
   * При недоступности сервиса капчи запрос пропускается (fail-open) —
   * так рекомендует Яндекс: сбой проверки не должен блокировать людей.
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
        this.logger.error(`Сервис капчи ответил ${response.status} — проверка пропущена`)
        return
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
      this.logger.error(`Сервис капчи недоступен — проверка пропущена: ${String(error)}`)
      return
    }

    if (status !== 'ok') {
      throw new ForbiddenException('Проверка капчи не пройдена')
    }
  }
}
