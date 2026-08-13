import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MyReview, UpdateReviewRequest } from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'

interface UpdateReviewVariables extends UpdateReviewRequest {
  reviewId: string
}

/**
 * Правка своего отзыва. Она возвращает его на проверку, поэтому устаревают и
 * счётчики домов, и оба списка отзывов — как после создания.
 */
export function useUpdateReviewMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, ...body }: UpdateReviewVariables) =>
      api.patch<MyReview>(`/api/reviews/${reviewId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.houses })
      void queryClient.invalidateQueries({ queryKey: queryKeyRoots.reviews })
    },
  })
}
