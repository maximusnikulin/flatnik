import { queryOptions } from '@tanstack/react-query'
import type { CityListItem, CityPage, HousePage, StreetPage } from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'

export const catalogKeys = {
  all: queryKeyRoots.catalog,
  cities: () => [...queryKeyRoots.catalog, 'cities'] as const,
  city: (citySlug: string, page: number) =>
    [...queryKeyRoots.catalog, 'city', citySlug, page] as const,
  street: (citySlug: string, streetSlug: string, page: number) =>
    [...queryKeyRoots.catalog, 'street', citySlug, streetSlug, page] as const,
  house: (citySlug: string, streetSlug: string, houseSlug: string) =>
    [...queryKeyRoots.catalog, 'house', citySlug, streetSlug, houseSlug] as const,
}

/** Города, где есть подтверждённые отзывы */
export const citiesQuery = () =>
  queryOptions({
    queryKey: catalogKeys.cities(),
    queryFn: () => api.get<CityListItem[]>('/api/catalog/cities'),
  })

/** Улицы города */
export const cityQuery = (citySlug: string, page = 1) =>
  queryOptions({
    queryKey: catalogKeys.city(citySlug, page),
    queryFn: () =>
      api.get<CityPage>(`/api/catalog/cities/${encodeURIComponent(citySlug)}?page=${page}`),
  })

/** Дома улицы */
export const streetQuery = (citySlug: string, streetSlug: string, page = 1) =>
  queryOptions({
    queryKey: catalogKeys.street(citySlug, streetSlug, page),
    queryFn: () =>
      api.get<StreetPage>(
        `/api/catalog/cities/${encodeURIComponent(citySlug)}/streets/${encodeURIComponent(streetSlug)}?page=${page}`,
      ),
  })

/** Дом со всеми подтверждёнными отзывами */
export const houseQuery = (citySlug: string, streetSlug: string, houseSlug: string) =>
  queryOptions({
    queryKey: catalogKeys.house(citySlug, streetSlug, houseSlug),
    queryFn: () =>
      api.get<HousePage>(
        `/api/catalog/cities/${encodeURIComponent(citySlug)}/streets/${encodeURIComponent(streetSlug)}/houses/${encodeURIComponent(houseSlug)}`,
      ),
  })
