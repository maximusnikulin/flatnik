import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AuthResponse,
  CurrentUser,
  RequestCodeRequest,
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
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.auth })
    },
  })
}
