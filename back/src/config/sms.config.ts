import { registerAs } from '@nestjs/config'

/**
 * SMS Aero. Доступы к API — пара «email аккаунта + ключ» (HTTP Basic), поэтому
 * без любого из двух отправка выключена: код печатается в лог. Это допустимо
 * только в разработке — в production приложение с пустыми доступами не стартует,
 * иначе вход молча работал бы через лог, до которого у пользователя нет доступа.
 *
 * Код уходит в Telegram. SMSAERO_SIGN — своё имя отправителя, заказывается
 * в кабинете; заданное, оно включает каскад: не доставили в Telegram — уйдёт SMS.
 */
export const smsConfig = registerAs('sms', () => {
  const apiKey = process.env.SMSAERO_API_KEY ?? ''
  const email = process.env.SMSAERO_EMAIL ?? ''
  // Пусто — каскада нет, код уходит только в Telegram. Бесплатное имя «SMS Aero»
  // сюда подставлять бессмысленно: SMS с кодом от него операторы отклоняют.
  const sign = process.env.SMSAERO_SIGN ?? ''

  if (!(apiKey && email) && process.env.NODE_ENV === 'production') {
    throw new Error(
      'SMSAERO_API_KEY и SMSAERO_EMAIL обязательны в production: без них коды входа не отправляются',
    )
  }

  return { apiKey, email, sign }
})
