import { registerAs } from '@nestjs/config'

/** Yandex SmartCaptcha; пустой серверный ключ выключает проверку */
export const captchaConfig = registerAs('captcha', () => ({
  serverKey: process.env.SMARTCAPTCHA_SERVER_KEY ?? '',
}))
