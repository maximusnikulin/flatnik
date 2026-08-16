/** Раньше этого месяца период съёма не принимается: почти наверняка опечатка в годе */
export const MIN_MONTH = '1990-01'

/** Текущий месяц в формате хранения — верхняя граница периода: съём в будущем не отзыв */
export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** '2024-03' → '03.2024'; период съёма хранится с точностью до месяца */
export function formatMonth(iso: string): string {
  if (!iso) return ''
  const [year, month] = iso.split('-')
  return `${month}.${year}`
}

/**
 * Обратное преобразование, из набранного в маске в формат хранения.
 * Недобранный или бессмысленный ввод даёт пустую строку — то же самое,
 * что «месяц не задан»: период необязательный.
 */
export function parseMonth(display: string): string {
  const parts = /^(\d{1,2})\.(\d{4})$/.exec(display)
  if (!parts) return ''
  const month = Number(parts[1])
  if (month < 1 || month > 12) return ''
  return `${parts[2]}-${String(month).padStart(2, '0')}`
}
