import { queryOptions } from '@tanstack/react-query'
import type { MyReview, Review } from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'

export const reviewsKeys = {
  all: queryKeyRoots.reviews,
  byApartment: (apartmentId: string) =>
    [...queryKeyRoots.reviews, 'by-apartment', apartmentId] as const,
  mine: () => [...queryKeyRoots.reviews, 'mine'] as const,
}

/** Отзывы одной квартиры, новые сверху */
export const apartmentReviewsQuery = (apartmentId: string) =>
  queryOptions({
    queryKey: reviewsKeys.byApartment(apartmentId),
    queryFn: () => api.get<Review[]>(`/api/apartments/${apartmentId}/reviews`),
  })

/** Свои отзывы с адресами; запрашиваются только с токеном */
export const myReviewsQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: reviewsKeys.mine(),
    queryFn: () => api.get<MyReview[]>('/api/reviews/me'),
    enabled,
  })
