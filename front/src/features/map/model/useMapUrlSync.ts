import { useEffect, useRef } from 'react'
import { useMapStore } from './map.store'

/**
 * Синхронизирует состояние выбора (дом, квартира) с History API.
 *
 * Направления:
 * – При загрузке: URL → store (восстановление выбора из расшаренной ссылки).
 * – При изменении стейта: store → URL (обновление адресной строки).
 *
 * Параметры:
 *   address, lat, lon   — выбранный дом
 *   aptId, aptNum, aptEntr — выбранная квартира (все три нужны, чтобы сразу
 *                            открыть ReviewsPanel без ожидания houseByAddressQuery)
 *
 * pushState — при выборе нового дома (новая запись в истории браузера).
 * replaceState — при выборе квартиры внутри того же дома и при сбросе.
 *
 * Известное ограничение: кнопка «Назад» меняет URL, но стор не сбрасывается.
 * Если нужно, добавить popstate-обработчик отдельно.
 */
export function useMapUrlSync() {
  const selectedAddress = useMapStore((s) => s.selectedAddress)
  const selectedApartment = useMapStore((s) => s.selectedApartment)

  // true пока не отработал mount-эффект; блокирует синхронизацию до инициализации
  const initializedRef = useRef(false)
  // true во время первого вызова sync-эффекта после восстановления из URL
  const restoringRef = useRef(false)
  // предыдущий адрес — чтобы различать pushState (новый дом) и replaceState
  const prevAddressRef = useRef<string | null>(null)

  // 1. Восстановление из URL при монтировании
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const address = params.get('address')
    const lat = params.get('lat')
    const lon = params.get('lon')

    if (address && lat && lon) {
      restoringRef.current = true
      // Пред-устанавливаем prevAddress, чтобы sync-эффект не сделал ложный pushState
      prevAddressRef.current = address

      const store = useMapStore.getState()
      store.selectAddress({ address, lat: parseFloat(lat), lon: parseFloat(lon) })

      const aptId = params.get('aptId')
      const aptNum = params.get('aptNum')
      const aptEntr = params.get('aptEntr')
      if (aptId && aptNum && aptEntr) {
        store.selectApartment({ id: aptId, number: aptNum, entrance: aptEntr })
      }
    }

    initializedRef.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Синхронизация store → URL при изменении выбора
  useEffect(() => {
    if (!initializedRef.current) return

    if (restoringRef.current) {
      // Первый вызов после восстановления — пропускаем, prevAddressRef уже выставлен
      restoringRef.current = false
      return
    }

    const url = new URL(window.location.href)
    const newAddress = selectedAddress?.address ?? null
    const isNewHouse = newAddress !== null && newAddress !== prevAddressRef.current
    prevAddressRef.current = newAddress

    if (!selectedAddress) {
      // Сброс выбора — убираем все параметры
      ;['address', 'lat', 'lon', 'aptId', 'aptNum', 'aptEntr'].forEach((k) =>
        url.searchParams.delete(k),
      )
      window.history.replaceState({}, '', url.toString())
      return
    }

    url.searchParams.set('address', selectedAddress.address)
    url.searchParams.set('lat', String(selectedAddress.lat))
    url.searchParams.set('lon', String(selectedAddress.lon))

    if (selectedApartment) {
      url.searchParams.set('aptId', selectedApartment.id)
      url.searchParams.set('aptNum', selectedApartment.number)
      url.searchParams.set('aptEntr', selectedApartment.entrance)
    } else {
      ;['aptId', 'aptNum', 'aptEntr'].forEach((k) => url.searchParams.delete(k))
    }

    if (isNewHouse) {
      window.history.pushState({}, '', url.toString())
    } else {
      window.history.replaceState({}, '', url.toString())
    }
  }, [selectedAddress, selectedApartment])
}
