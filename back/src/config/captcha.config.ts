import { registerAs } from '@nestjs/config'

/**
 * Yandex SmartCaptcha. Пустой серверный ключ выключает проверку — это допустимо
 * только в разработке, поэтому в production приложение с ним не стартует: молча
 * работающий без капчи прод неотличим от защищённого.
 */
export const captchaConfig = registerAs('captcha', () => {
  const serverKey = process.env.SMARTCAPTCHA_SERVER_KEY ?? ''
  if (!serverKey && process.env.NODE_ENV === 'production') {
    throw new Error('SMARTCAPTCHA_SERVER_KEY обязателен в production: без него капча выключена')
  }
  return { serverKey }
})
