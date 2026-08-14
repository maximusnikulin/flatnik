import { registerAs } from '@nestjs/config'

/**
 * SMS Aero. Доступы к API — пара «email аккаунта + ключ» (HTTP Basic), поэтому
 * без любого из двух вход работает без провайдера: код печатается в лог. Это
 * допустимо только в разработке — в production приложение с пустыми доступами
 * не стартует, иначе вход молча работал бы через лог, до которого у пользователя
 * нет доступа.
 *
 * Основной путь входа — «мобильная авторизация» (mobile-id): подтверждение
 * приходит на SIM-карту. Запасной — код в Telegram с каскадом в SMS.
 */
export const smsConfig = registerAs('sms', () => {
  const apiKey = process.env.SMSAERO_API_KEY ?? ''
  const email = process.env.SMSAERO_EMAIL ?? ''
  // Своё имя отправителя. Для каскада SMS пусто = каскада нет: бесплатное имя
  // «SMS Aero» сюда подставлять бессмысленно, SMS с кодом от него операторы
  // отклоняют. В mobile-id подпись обязательна по схеме метода, и там пустое
  // значение заменяется бесплатным именем (см. MobileIdService).
  const sign = process.env.SMSAERO_SIGN ?? ''
  // Адрес сайта наружу: из него собирается callbackUrl для mobile-id. Мы узнаём
  // результат опросом статуса, но поле в запросе провайдер требует заполненным.
  const publicUrl = (process.env.PUBLIC_URL ?? 'https://flatnik.ru').replace(/\/+$/, '')

  if (!(apiKey && email) && process.env.NODE_ENV === 'production') {
    throw new Error(
      'SMSAERO_API_KEY и SMSAERO_EMAIL обязательны в production: без них вход не работает',
    )
  }

  return { apiKey, email, sign, publicUrl }
})
