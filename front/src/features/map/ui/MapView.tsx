import { useMemo } from 'react'
import type { YMapLocationRequest } from '@yandex/ymaps3-types'
import type { HousePin } from '@flatnik/shared'
import { useYmaps } from '../lib/ymaps'
import { useMapStore } from '../model/map.store'

/** Москва целиком, пока адрес не выбран */
const DEFAULT_LOCATION: YMapLocationRequest = {
  center: [37.6176, 55.7558],
  zoom: 11,
}

interface MapViewProps {
  pins: HousePin[]
  onPinClick: (pin: HousePin) => void
}

export function MapView({ pins, onPinClick }: MapViewProps) {
  const ymaps = useYmaps()
  const selectedAddress = useMapStore((s) => s.selectedAddress)

  // Новый объект location на каждый рендер заставлял бы карту прыгать —
  // мемоизируем по выбранному адресу
  const location = useMemo<YMapLocationRequest>(
    () =>
      selectedAddress
        ? { center: [selectedAddress.lon, selectedAddress.lat], zoom: 17, duration: 400 }
        : DEFAULT_LOCATION,
    [selectedAddress],
  )

  if (ymaps.status !== 'ready') {
    return (
      <div className="map-stub">
        {ymaps.status === 'loading' && <p>Загружаем карту…</p>}
        {ymaps.status === 'error' && <p>Не удалось загрузить Яндекс Карты: {ymaps.message}</p>}
        {ymaps.status === 'disabled' && (
          <>
            <p>
              Карта отключена: не задан <code>VITE_YANDEX_MAPS_API_KEY</code> (см. .env.example).
            </p>
            {pins.length > 0 && (
              <div className="map-stub-list">
                <p>Дома, по которым есть отзывы:</p>
                {pins.map((pin) => (
                  <button key={pin.id} type="button" onClick={() => onPinClick(pin)}>
                    {pin.address}
                    <span className="map-pin -inline">{pin.confirmedCount + pin.pendingCount}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps.components

  return (
    <YMap location={location} mode="vector">
      <YMapDefaultSchemeLayer />
      <YMapDefaultFeaturesLayer />
      {pins.map((pin) => (
        <YMapMarker key={pin.id} coordinates={[pin.lon, pin.lat]}>
          <button
            type="button"
            className="map-pin"
            title={pin.address}
            onClick={() => onPinClick(pin)}
          >
            {pin.confirmedCount + pin.pendingCount}
          </button>
        </YMapMarker>
      ))}
    </YMap>
  )
}
