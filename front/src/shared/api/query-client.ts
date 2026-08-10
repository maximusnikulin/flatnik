import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './fetcher'

/** Общие настройки Query: клиентские ошибки (4xx) не ретраим */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})
