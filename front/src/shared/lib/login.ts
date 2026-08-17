import { isPhoneComplete, toE164 } from './phone'

/** Чем входят: поле одно, а флоу за ним два */
export type LoginKind = 'phone' | 'email'

/**
 * Что ввели. Собачка — единственный надёжный признак: в телефоне её быть
 * не может. Пустое и недобранное считаем телефоном, чтобы поле начиналось
 * с телефонной маски, а не переключалось на неё задним числом.
 */
export function detectLoginKind(input: string): LoginKind {
  return input.includes('@') ? 'email' : 'phone'
}

/**
 * Ввод целиком похож на адрес почты. Нарочно грубее серверной проверки:
 * задача — решить, разблокировать ли кнопку, а не валидировать адрес.
 * Точную форму проверит бэкенд, и его сообщение доедет до формы.
 */
export function isEmailComplete(input: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.trim())
}

/** Ввод готов к отправке — что бы в нём ни было */
export function isLoginComplete(input: string, digits: string): boolean {
  return detectLoginKind(input) === 'email' ? isEmailComplete(input) : isPhoneComplete(digits)
}

/**
 * Приводит ввод к тому, что ждёт бэкенд: телефон — к +7XXXXXXXXXX, почту —
 * к нижнему регистру без пробелов по краям.
 */
export function toLogin(input: string, digits: string): string {
  return detectLoginKind(input) === 'email' ? input.trim().toLowerCase() : toE164(digits)
}
