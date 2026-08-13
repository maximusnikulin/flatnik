/** Достаёт из ошибки fetch вложенную причину — без неё в логе только «fetch failed» */
export function describeCause(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined
  if (cause instanceof Error) {
    const code = 'code' in cause && typeof cause.code === 'string' ? `${cause.code}: ` : ''
    return `${code}${cause.message}`
  }
  return 'причина не указана'
}
