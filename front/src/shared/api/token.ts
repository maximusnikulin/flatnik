/**
 * Хранение JWT отдельно от стора авторизации: fetcher из shared не может
 * импортировать фичу auth, поэтому стор синхронизирует токен сюда.
 */
const STORAGE_KEY = 'flatnik:token'

function readInitial(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let currentToken: string | null = readInitial()

export function getAuthToken(): string | null {
  return currentToken
}

export function setAuthToken(token: string | null): void {
  currentToken = token
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // приватный режим без localStorage — токен проживёт до перезагрузки
  }
}
