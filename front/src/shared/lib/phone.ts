/** Цифр в российском номере без кода страны — столько собирает маска в `PhoneInput` */
export const PHONE_DIGITS = 10

/** Номер целиком набран и его можно отправлять */
export function isPhoneComplete(digits: string): boolean {
  return digits.length === PHONE_DIGITS
}

/** Номер для API: бэкенд принимает только формат +7XXXXXXXXXX */
export function toE164(digits: string): string {
  return `+7${digits}`
}

/** Номер для показа человеку — в том же виде, в каком он его набрал в маске */
export function formatPhone(digits: string): string {
  const parts = /^(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits)
  return parts ? `+7 (${parts[1]}) ${parts[2]}-${parts[3]}-${parts[4]}` : toE164(digits)
}
