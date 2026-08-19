import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  AuthResponse,
  CurrentUser,
  EmailRequest,
  RequestCodeRequest,
  RequestCodeResponse,
  SessionStatus,
  SetNicknameRequest,
  VerifyCodeRequest,
  VerifyEmailRequest,
} from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'
import { useAuthStore } from '../model/auth.store'

export const authKeys = {
  all: queryKeyRoots.auth,
  me: () => [...queryKeyRoots.auth, 'me'] as const,
}

/** Профиль текущего пользователя; запрашивается только с токеном */
export const meQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: () => api.get<CurrentUser>('/api/auth/me'),
    enabled,
  })

/**
 * Финал входа: токен в сторе, профиль в кеше. Вынесен отдельно, потому что
 * попадают сюда не только из формы — сюда же приходит любой будущий способ
 * входа, который бэкенд закончит выдачей токена.
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

  // Согласие человек дал ещё до запроса кода — нажатием кнопки, о чём
  // сказано прямо под ней, — но сохранить его было некуда: эндпоинт требует
  // токен. Поэтому запись идёт здесь, где оба пути входа уже сошлись.
  // Сюда же попадают аккаунты, заведённые до появления согласия: у них
  // consentAccepted false, и дата проставится при первом же входе.
  if (!data.user.consentAccepted) {
    void recordConsent(queryClient)
  }
}

/**
 * Сохранить согласие на сервере. Сбой не рвёт вход: токен уже выдан, а
 * несохранённая дата — повод повторить запись при следующем входе, но не
 * повод не пускать человека внутрь.
 */
async function recordConsent(queryClient: QueryClient): Promise<void> {
  try {
    const user = await api.post<CurrentUser>('/api/auth/me/consent')
    queryClient.setQueryData(authKeys.me(), user)
  } catch {
    // Молча: следующий вход попробует записать снова
  }
}

/**
 * Шаг 1: начать вход. Письмо с кодом уходит уже здесь, поэтому дальше форма
 * сразу просит код. Секрет сессии в ответе остаётся ради телефонного входа,
 * который бэкенд по-прежнему умеет, — почте он не нужен.
 */
export function useRequestCodeMutation() {
  return useMutation({
    mutationFn: (body: RequestCodeRequest) =>
      api.post<RequestCodeResponse>('/api/auth/request-code', body),
  })
}



/** Шаг 2: обменять код из письма на JWT */
export function useVerifyCodeMutation() {
  const queryClient = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  return useMutation({
    mutationFn: (body: VerifyCodeRequest) => api.post<AuthResponse>('/api/auth/verify-code', body),
    onSuccess: (data) => acceptSession(queryClient, setToken, data),
  })
}

/**
 * Принять пользовательское соглашение и согласие на обработку персональных
 * данных — одним действием, как они и предъявляются человеку.
 *
 * Ответ — тот же профиль, что отдаёт `/api/auth/me`, поэтому он кладётся
 * прямо в кеш: перезапрашивать его ради одного флага незачем, а блокирующее
 * окно должно исчезнуть сразу.
 */
export function useAcceptConsentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    // Тела у запроса нет: эндпоинт опознаёт человека по токену
    mutationFn: () => api.post<CurrentUser>('/api/auth/me/consent'),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user)
    },
  })
}

/**
 * Прислать код подтверждения почты уже вошедшему человеку. Нужен в форме
 * отзыва: на подтверждённую почту уходит решение модератора. 409 — почта
 * занята другим аккаунтом.
 */
export function useRequestEmailCodeMutation() {
  return useMutation({
    mutationFn: (body: EmailRequest) => api.post<void>('/api/auth/me/email/request-code', body),
  })
}

/** Подтвердить почту кодом из письма; в ответе — обновлённый профиль */
export function useVerifyEmailMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: VerifyEmailRequest) =>
      api.post<CurrentUser>('/api/auth/me/email/verify', body),
    // Профиль кладём в кеш сразу: по нему форма отзыва понимает, что почта
    // появилась, и убирает шаг подтверждения
    onSuccess: (user) => queryClient.setQueryData(authKeys.me(), user),
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
