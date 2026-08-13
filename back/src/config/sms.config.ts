import { registerAs } from '@nestjs/config'

/**
 * SMS Aero. Доступы к API — пара «email аккаунта + ключ» (HTTP Basic), поэтому
 * без любого из двух отправка выключена: код печатается в лог. Это допустимо
 * только в разработке — в production приложение с пустыми доступами не стартует,
 * иначе вход молча работал бы через лог, до которого у пользователя нет доступа.
 */
export const smsConfig = registerAs('sms', () => {
  const apiKey = process.env.SMSAERO_API_KEY ?? ''
  const email = process.env.SMSAERO_EMAIL ?? ''
  // Имя отправителя обязательно в каждом запросе. «SMS Aero» — бесплатное имя
  // для тестов; с ним оператор требует указывать источник в тексте сообщения.
  const sign = process.env.SMSAERO_SIGN || 'SMS Aero'

  if (!(apiKey && email) && process.env.NODE_ENV === 'production') {
    throw new Error(
      'SMSAERO_API_KEY и SMSAERO_EMAIL обязательны в production: без них коды входа не отправляются',
    )
  }

  return { apiKey, email, sign }
})
