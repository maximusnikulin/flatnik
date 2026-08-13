import { getAuthToken } from './token'

/** Ошибка HTTP с кодом ответа и сообщением бэкенда */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const payload: unknown = await res.json()
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const { message } = payload
      if (typeof message === 'string') return message
      if (Array.isArray(message)) {
        return message.filter((item): item is string => typeof item === 'string').join('; ')
      }
    }
  } catch {
    // тело не JSON — вернём код
  }
  return `HTTP ${res.status}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAuthToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(path, { ...init, headers })
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res))
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
}
