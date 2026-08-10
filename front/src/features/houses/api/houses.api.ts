import { queryOptions } from '@tanstack/react-query'
import type { HouseLookupResponse, HousePin } from '@flatnik/shared'
import { api } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'

export const housesKeys = {
  all: queryKeyRoots.houses,
  list: () => [...queryKeyRoots.houses, 'list'] as const,
  byAddress: (address: string) => [...queryKeyRoots.houses, 'by-address', address] as const,
}

/** Все дома с отзывами — пины на карте */
export const housesQuery = () =>
  queryOptions({
    queryKey: housesKeys.list(),
    queryFn: () => api.get<HousePin[]>('/api/houses'),
  })

/** Дом с квартирами и счётчиками по каноническому адресу */
export const houseByAddressQuery = (address: string) =>
  queryOptions({
    queryKey: housesKeys.byAddress(address),
    queryFn: () =>
      api.get<HouseLookupResponse>(`/api/houses/by-address?address=${encodeURIComponent(address)}`),
  })
