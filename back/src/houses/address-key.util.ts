/**
 * Нормализует адрес для поиска дубликатов: регистр, пробелы, ё.
 * Канонизацию формулировок делает геокодер на фронте — сюда приходит
 * уже его вариант написания адреса.
 */
export function normalizeAddressKey(address: string): string {
  return address.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}
