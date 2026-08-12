import { create } from 'zustand'

export interface SelectedAddress {
  address: string
  lat: number
  lon: number
}

export interface SelectedApartment {
  id: string
  number: string
  entrance: string
}

interface MapSelectionState {
  /** Выбранный на карте или через поиск адрес (только для зданий) */
  selectedAddress: SelectedAddress | null
  /** Подъезд, чьи квартиры открыты; null — показан список подъездов */
  selectedEntrance: string | null
  /** Квартира, чьи отзывы открыты */
  selectedApartment: SelectedApartment | null
  /** Последняя позиция карты — чтобы не улетала в центр при сбросе */
  lastCenter: [number, number] | null
  lastZoom: number | null
  selectAddress: (address: SelectedAddress) => void
  /** Только переместить карту (для улиц/районов, без панели) */
  setMapCenter: (center: [number, number], zoom: number) => void
  selectEntrance: (entrance: string) => void
  clearEntrance: () => void
  selectApartment: (apartment: SelectedApartment) => void
  clearApartment: () => void
  clearSelection: () => void
}

export const useMapStore = create<MapSelectionState>((set) => ({
  selectedAddress: null,
  selectedEntrance: null,
  selectedApartment: null,
  lastCenter: null,
  lastZoom: null,
  // Новый дом сбрасывает всю вложенную навигацию и запоминает позицию
  selectAddress: (selectedAddress) =>
    set({
      selectedAddress,
      selectedEntrance: null,
      selectedApartment: null,
      lastCenter: [selectedAddress.lon, selectedAddress.lat],
      lastZoom: 17,
    }),
  // Только переместить карту — для улиц/районов, без панели
  setMapCenter: (center, zoom) => set({ lastCenter: center, lastZoom: zoom }),
  selectEntrance: (selectedEntrance) => set({ selectedEntrance, selectedApartment: null }),
  clearEntrance: () => set({ selectedEntrance: null, selectedApartment: null }),
  // Отзыв может быть создан в подъезде, который ещё не выбран, — открываем его вместе с квартирой
  selectApartment: (selectedApartment) =>
    set({ selectedApartment, selectedEntrance: selectedApartment.entrance }),
  clearApartment: () => set({ selectedApartment: null }),
  // Сброс выбора не меняет позицию карты — она останется где была
  clearSelection: () =>
    set({ selectedAddress: null, selectedEntrance: null, selectedApartment: null }),
}))
