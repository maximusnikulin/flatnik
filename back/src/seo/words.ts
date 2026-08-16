/**
 * Русские окончания и падежи для заголовков страниц.
 *
 * Дублирует front/src/pages/ui/PageShell.tsx и front/src/shared/lib/city-case.ts:
 * одни и те же заголовки собирают сервер (для поисковика и первого кадра) и
 * клиент (при переходах внутри приложения). Формулировки обязаны совпадать —
 * расхождение читается как подмена контента. Правишь здесь — правь и там.
 */

/** Форма слова по числу: [1, 2–4, 5–20] */
function plural(count: number, forms: [string, string, string]): string {
  const tens = count % 100
  const ones = count % 10
  if (tens >= 11 && tens <= 14) return forms[2]
  if (ones === 1) return forms[0]
  if (ones >= 2 && ones <= 4) return forms[1]
  return forms[2]
}

export function reviewsWord(count: number): string {
  return plural(count, ['отзыв', 'отзыва', 'отзывов'])
}

export function housesWord(count: number): string {
  return plural(count, ['доме', 'домах', 'домах'])
}

export function apartmentsWord(count: number): string {
  return plural(count, ['квартире', 'квартирах', 'квартирах'])
}

export function streetsWord(count: number): string {
  return plural(count, ['улице', 'улицам', 'улицам'])
}

/**
 * Город в предложном падеже: «Москва» → «в Москве».
 *
 * Правила приблизительные и покрывают массовые случаи: «отзывы о квартирах в
 * Москве» — реальный поисковый запрос, а «в Москва» просто выглядит браком.
 * Точное склонение топонимов требует словаря ради единиц исключений.
 */
export function cityIn(cityName: string): string {
  const name = cityName.trim()
  if (!name) return name

  const lower = name.toLowerCase()

  if (lower.endsWith('ия')) return `${name.slice(0, -1)}и`
  if (lower.endsWith('а')) return `${name.slice(0, -1)}е`
  if (lower.endsWith('ь')) return `${name.slice(0, -1)}и`
  // Химки → Химках, Мытищи → Мытищах
  if (lower.endsWith('и')) return `${name.slice(0, -1)}ах`
  if (lower.endsWith('о')) return `${name.slice(0, -1)}е`
  if (/[бвгджзклмнпрстфхцчшщ]$/u.test(lower)) return `${name}е`

  return name
}

/** Средняя оценка для показа: «4,3» */
export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',')
}
