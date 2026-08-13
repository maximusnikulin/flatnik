import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AuthResponse,
  CurrentUser,
  RequestCodeRequest,
  SetNicknameRequest,
  VerifyCodeRequest,
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

/** Шаг 1: запросить код (бэкенд печатает его в свой лог) */
export function useRequestCodeMutation() {
  return useMutation({
    mutationFn: (body: RequestCodeRequest) => api.post<void>('/api/auth/request-code', body),
  })
}

/** Шаг 2: обменять код на JWT */
export function useVerifyCodeMutation() {
  const queryClient = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  return useMutation({
    mutationFn: (body: VerifyCodeRequest) => api.post<AuthResponse>('/api/auth/verify-code', body),
    onSuccess: (data) => {
      setToken(data.accessToken)
      // Профиль кладём в кеш сразу: по nicknameConfirmed решается, показывать
      // ли шаг выбора ника, и ждать отдельного запроса ради этого незачем
      queryClient.setQueryData(authKeys.me(), data.user)
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.auth })
    },
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
