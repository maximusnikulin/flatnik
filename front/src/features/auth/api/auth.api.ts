import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  AuthResponse,
  CurrentUser,
  RequestCodeRequest,
  RequestCodeResponse,
  SessionStatus,
  SetNicknameRequest,
  VerifyCodeRequest,
} from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'
import { useAuthStore } from '../model/auth.store'

export const authKeys = {
  all: queryKeyRoots.auth,
  me: () => [...queryKeyRoots.auth, 'me'] as const,
  session: (phone: string) => [...queryKeyRoots.auth, 'session', phone] as const,
}

/** Как часто спрашиваем, подтвердил ли человек вход на телефоне */
const SESSION_POLL_MS = 3000

/** Профиль текущего пользователя; запрашивается только с токеном */
export const meQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: () => api.get<CurrentUser>('/api/auth/me'),
    enabled,
  })

/**
 * Финал входа, общий для обоих путей: и подтверждение на телефоне, и код
 * приводят к одному и тому же — токен в сторе, профиль в кеше.
 */
function acceptSession(
  queryClient: QueryClient,
  setToken: (token: string) => void,
  data: { accessToken: string; user: CurrentUser },
) {
  setToken(data.accessToken)
  // Профиль кладём в кеш сразу: по nicknameConfirmed решается, показывать
  // ли шаг выбора ника, и ждать отдельного запроса ради этого незачем
  queryClient.setQueryData(authKeys.me(), data.user)
  void queryClient.invalidateQueries({ queryKey: queryKeyRoots.auth })
}

/**
 * Шаг 1: начать вход. Ответ говорит, что показывать дальше: `needsCode` —
 * поле ввода кода, иначе ожидание подтверждения на телефоне.
 */
export function useRequestCodeMutation() {
  return useMutation({
    mutationFn: (body: RequestCodeRequest) =>
      api.post<RequestCodeResponse>('/api/auth/request-code', body),
  })
}

/**
 * Шаг 2а (мобильная авторизация): опрос статуса, пока человек подтверждает вход
 * на телефоне. Интервал живёт рядом с запросом, а не в компоненте: опрос
 * прекращается по самому ответу, и разносить эти два условия незачем.
 */
export const authSessionQuery = (phone: string, sessionId: string, enabled: boolean) =>
  queryOptions({
    queryKey: authKeys.session(phone),
    queryFn: () => api.post<SessionStatus>('/api/auth/session', { phone, sessionId }),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? SESSION_POLL_MS : false),
    // Ответ живёт ровно одну попытку входа: между попытками он бесполезен,
    // а показанный из кеша «confirmed» закрыл бы модалку без входа
    gcTime: 0,
    staleTime: 0,
  })

/** Принять подтверждённую сессию: токен в стор, профиль в кеш */
export function useAcceptSession() {
  const queryClient = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  return (data: { accessToken: string; user: CurrentUser }) =>
    acceptSession(queryClient, setToken, data)
}

/** Шаг 2б (запасной путь): обменять код из сообщения на JWT */
export function useVerifyCodeMutation() {
  const queryClient = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  return useMutation({
    mutationFn: (body: VerifyCodeRequest) => api.post<AuthResponse>('/api/auth/verify-code', body),
    onSuccess: (data) => acceptSession(queryClient, setToken, data),
  })
}

/** Шаг 3: выбрать никнейм. 409 — ник занят */
export function useSetNicknameMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SetNicknameRequest) =>
      api.patch<CurrentUser>('/api/auth/me/nickname', body),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user)
      // Ник подписывает отзывы — их списки тоже устарели
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.reviews })
    },
  })
}
