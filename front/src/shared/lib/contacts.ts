/**
 * Контакты и юридические документы — в одном месте, потому что адрес почты
 * стоит в подвале, в окне согласия и в каждой карточке отзыва сразу.
 *
 * Документы лежат в `front/public/legal` и собираются из markdown командой
 * `npm run legal:pdf`; Vite копирует их в бандл как есть, поэтому это готовые
 * публичные адреса, а не маршруты роутера.
 */

/** Единый адрес для жалоб на отзывы, обратной связи и обращений по 152-ФЗ */
export const SUPPORT_EMAIL = 'support@flatnik.ru'

export const USER_AGREEMENT_URL = '/legal/user-agreement.pdf'
export const PRIVACY_POLICY_URL = '/legal/privacy-policy.pdf'
/** Разъяснение про cookie: на него ведёт «Подробнее» в баннере */
export const COOKIE_CONSENT_URL = '/legal/consent-cookies.pdf'

/**
 * Ссылка `mailto:` с заполненными темой и телом письма.
 *
 * Перевод строки в теле кодируется как %0D%0A: часть почтовых клиентов
 * игнорирует одиночный %0A и склеивает заготовку в одну строку.
 */
export function mailtoUrl(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject })
  // Переводы строк приводим к CRLF до кодирования, чтобы не переписывать
  // уже готовые %0D%0A в закодированной строке
  if (body !== undefined) params.set('body', body.replace(/\r?\n/g, '\r\n'))
  // URLSearchParams кодирует пробел как «+», а в mailto его так не понимают
  const query = params.toString().replace(/\+/g, '%20')
  return `mailto:${SUPPORT_EMAIL}?${query}`
}
