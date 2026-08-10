import { queryOptions } from '@tanstack/react-query'
import type { Review } from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'

export const reviewsKeys = {
  all: queryKeyRoots.reviews,
  byApartment: (apartmentId: string) =>
    [...queryKeyRoots.reviews, 'by-apartment', apartmentId] as const,
}

/** Отзывы одной квартиры, новые сверху */
export const apartmentReviewsQuery = (apartmentId: string) =>
  queryOptions({
    queryKey: reviewsKeys.byApartment(apartmentId),
    queryFn: () => api.get<Review[]>(`/api/apartments/${apartmentId}/reviews`),
  })
