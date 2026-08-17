import { registerAs } from '@nestjs/config'

/** Порт по умолчанию — SMTPS: с ним же идёт secure: true */
const DEFAULT_PORT = 465

/**
 * Исходящая почта: код подтверждения и решение модератора по отзыву.
 *
 * Конфигурация generic-SMTP, к провайдеру не привязана. Пустой SMTP_HOST —
 * не ошибка: в разработке письма никуда не уходят, а код печатается в лог
 * (см. MailService). В production пустой хост останавливает старт, иначе
 * подтверждение почты молча работало бы через лог, до которого у пользователя
 * доступа нет.
 */
export const mailConfig = registerAs('mail', () => {
  const host = process.env.SMTP_HOST ?? ''
  const port = Number(process.env.SMTP_PORT ?? DEFAULT_PORT)
  // Явный флаг, а не вывод из порта: 465 — SMTPS с TLS сразу, 587 — STARTTLS
  // поверх открытого соединения, и провайдеры поддерживают разные комбинации
  const secure = (process.env.SMTP_SECURE ?? 'true') !== 'false'
  const user = process.env.SMTP_USER ?? ''
  const password = process.env.SMTP_PASSWORD ?? ''
  // Отправитель целиком, вместе с именем: «Квартирник <noreply@flatnik.ru>».
  // Пустой — берём ящик из SMTP_USER: у Яндекса адрес всё равно обязан
  // совпадать с тем, под которым авторизовались
  const from = process.env.SMTP_FROM || user

  if (!host && process.env.NODE_ENV === 'production') {
    throw new Error('SMTP_HOST обязателен в production: без него не отправить код на почту')
  }

  return { host, port, secure, user, password, from }
})
