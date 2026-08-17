import { registerAs } from '@nestjs/config'

/**
 * SMS Aero. Доступы к API — пара «email аккаунта + ключ» (HTTP Basic).
 *
 * Вход в сервисе один — «мобильная авторизация» (mobile-id): подтверждение
 * приходит на SIM-карту, а если SIM-PUSH не сработал, провайдер сам присылает
 * одноразовый код в SMS. Запасных путей нет, поэтому без доступов вход не
 * работает вовсе: приложение с пустыми доступами не стартует не только
 * в production — просто там это критично, а в разработке видно сразу.
 *
 * Тестовый режим включается самим ключом: положите сюда тестовый ключ из
 * «Настройки → API и SMPP» личного кабинета и оставьте SMSAERO_SIGN пустым.
 * SMS не отправляются, деньги не списываются, код подтверждения всегда 1234.
 */
export const smsConfig = registerAs('sms', () => {
  const apiKey = process.env.SMSAERO_API_KEY ?? ''
  const email = process.env.SMSAERO_EMAIL ?? ''
  // Своё имя отправителя, заказывается в кабинете. В mobile-id подпись
  // обязательна по схеме метода, поэтому пустое значение заменяется бесплатным
  // «SMS Aero» (см. MobileIdService) — оно же требуется в тестовом режиме.
  const sign = process.env.SMSAERO_SIGN ?? ''
  // Адрес сайта наружу: из него собирается callbackUrl для mobile-id. Провайдер
  // требует его заполненным, а приёмник по нему узнаёт о смене статуса заявки.
  const publicUrl = (process.env.PUBLIC_URL ?? 'https://flatnik.ru').replace(/\/+$/, '')

  if (!(apiKey && email) && process.env.NODE_ENV === 'production') {
    throw new Error(
      'SMSAERO_API_KEY и SMSAERO_EMAIL обязательны в production: без них вход не работает',
    )
  }

  return { apiKey, email, sign, publicUrl }
})
