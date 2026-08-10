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
  /** Выбранный на карте или через поиск адрес */
  selectedAddress: SelectedAddress | null
  /** Квартира, чьи отзывы открыты */
  selectedApartment: SelectedApartment | null
  selectAddress: (address: SelectedAddress) => void
  selectApartment: (apartment: SelectedApartment) => void
  clearApartment: () => void
  clearSelection: () => void
}

export const useMapStore = create<MapSelectionState>((set) => ({
  selectedAddress: null,
  selectedApartment: null,
  selectAddress: (selectedAddress) => set({ selectedAddress, selectedApartment: null }),
  selectApartment: (selectedApartment) => set({ selectedApartment }),
  clearApartment: () => set({ selectedApartment: null }),
  clearSelection: () => set({ selectedAddress: null, selectedApartment: null }),
}))
