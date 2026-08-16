import { useMemo } from 'react'
import type { YMapLocationRequest } from '@yandex/ymaps3-types'
import { useYmaps } from '../lib/ymaps'

interface HouseMapProps {
  lat: number
  lon: number
  /** Подпись под картой и alt-смысл блока для скринридера */
  address: string
}

/**
 * Карта одного дома блоком на странице.
 *
 * В отличие от MapView она ничего не выбирает: дом уже известен из адреса
 * страницы. Клика по зданиям здесь нет намеренно — платный геокодер не должен
 * дёргаться там, где адрес и так есть.
 *
 * Монтировать этот компонент нужно лениво: подписка на useYmaps запускает
 * загрузку скрипта карт.
 */
export function HouseMap({ lat, lon, address }: HouseMapProps) {
  const ymaps = useYmaps()

  const location = useMemo<YMapLocationRequest>(() => ({ center: [lon, lat], zoom: 17 }), [lat, lon])

  if (ymaps.status !== 'ready') {
    return (
      <div className="house-map -stub">
        {ymaps.status === 'loading' && <p>Загружаем карту…</p>}
        {ymaps.status === 'error' && <p>Не удалось загрузить карту: {ymaps.message}</p>}
        {ymaps.status === 'disabled' && <p>Карта отключена: не задан ключ Яндекс.Карт.</p>}
      </div>
    )
  }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps.components

  return (
    <div className="house-map" role="img" aria-label={`Дом на карте: ${address}`}>
      <YMap location={location} mode="vector">
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />
        <YMapMarker coordinates={[lon, lat]} blockEvents>
          <div className="map-pin -dot" />
        </YMapMarker>
      </YMap>
    </div>
  )
}
