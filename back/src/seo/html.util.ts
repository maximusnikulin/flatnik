/**
 * Экранирование для страниц, которые бэкенд собирает строками.
 *
 * Всё, что сюда попадает, — пользовательский ввод: тексты отзывов, никнеймы,
 * адреса от геокодера. Отзыв со строкой `</script>` без экранирования рвёт
 * разметку и открывает XSS, поэтому подстановка без этих функций недопустима.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Текстовый узел: `<b>` → `&lt;b&gt;` */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

/** Значение атрибута; отличается от текстового узла только намерением */
export function escapeAttr(value: string): string {
  return escapeHtml(value)
}

/**
 * JSON-LD внутрь <script>. Экранируется не JSON, а последовательность `<`:
 * парсер HTML закрывает скрипт по первому же `</script>` в его теле, откуда
 * бы оно ни взялось. `<` для JSON эквивалентен и безопасен.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
