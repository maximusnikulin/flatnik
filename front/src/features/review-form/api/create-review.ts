import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateReviewRequest, ReviewCreated } from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'

/** Создание отзыва; после успеха устаревают пины, квартиры и списки отзывов */
export function useCreateReviewMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateReviewRequest) => api.post<ReviewCreated>('/api/reviews', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.houses })
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.reviews })
    },
  })
}
