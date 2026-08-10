import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { HousePin } from '@flatnik/shared'
import { MapView } from '../features/map/ui/MapView'
import { SearchBar } from '../features/map/ui/SearchBar'
import { useMapStore } from '../features/map/model/map.store'
import { HousePanel } from '../features/houses/ui/HousePanel'
import { housesQuery } from '../features/houses/api/houses.api'
import { ReviewsPanel } from '../features/reviews/ui/ReviewsPanel'
import { AuthModal } from '../features/auth/ui/AuthModal'
import { useAuthStore } from '../features/auth/model/auth.store'
import { ReviewFormModal } from '../features/review-form/ui/ReviewFormModal'
import { useReviewFormStore } from '../features/review-form/model/review-form.store'
import type { ReviewFormPrefill } from '../features/review-form/model/review-form.store'

/**
 * Медиатор экрана: карта — фон, слева поиск и панели, поверх — модалки.
 * Фичи не импортируют друг друга; их связывает только этот компонент.
 */
export function App() {
  const selectedAddress = useMapStore((s) => s.selectedAddress)
  const selectedApartment = useMapStore((s) => s.selectedApartment)
  const selectAddress = useMapStore((s) => s.selectAddress)
  const selectApartment = useMapStore((s) => s.selectApartment)
  const clearApartment = useMapStore((s) => s.clearApartment)

  const token = useAuthStore((s) => s.token)
  const openAuthModal = useAuthStore((s) => s.openModal)

  const isFormOpen = useReviewFormStore((s) => s.isOpen)
  const openForm = useReviewFormStore((s) => s.open)

  // Намерение «открыть форму после входа»: null — без префилла
  const [pendingPrefill, setPendingPrefill] = useState<ReviewFormPrefill | null | undefined>(undefined)

  const { data: pins } = useQuery(housesQuery())

  const handleAddReview = (prefill?: ReviewFormPrefill) => {
    if (!token) {
      setPendingPrefill(prefill ?? null)
      openAuthModal()
      return
    }
    openForm(prefill)
  }

  useEffect(() => {
    if (token && pendingPrefill !== undefined) {
      openForm(pendingPrefill ?? undefined)
      setPendingPrefill(undefined)
    }
  }, [token, pendingPrefill, openForm])

  const handlePinClick = (pin: HousePin) => {
    selectAddress({ address: pin.address, lat: pin.lat, lon: pin.lon })
  }

  return (
    <div className="app">
      <div className="app__map">
        <MapView pins={pins ?? []} onPinClick={handlePinClick} />
      </div>

      <aside className="side-panel">
        <SearchBar />
        {selectedAddress && !selectedApartment && (
          <HousePanel
            address={selectedAddress.address}
            onSelectApartment={(apartment) =>
              selectApartment({
                id: apartment.id,
                number: apartment.number,
                entrance: apartment.entrance,
              })
            }
            onAddReview={() => handleAddReview()}
          />
        )}
        {selectedAddress && selectedApartment && (
          <ReviewsPanel
            apartmentId={selectedApartment.id}
            apartmentNumber={selectedApartment.number}
            onBack={clearApartment}
            onAddReview={() =>
              handleAddReview({
                apartmentNumber: selectedApartment.number,
                entrance: selectedApartment.entrance,
              })
            }
          />
        )}
      </aside>

      {isFormOpen && selectedAddress && (
        <ReviewFormModal
          address={selectedAddress.address}
          lat={selectedAddress.lat}
          lon={selectedAddress.lon}
          onCreated={(apartment) => selectApartment(apartment)}
          onUnauthorized={openAuthModal}
        />
      )}
      <AuthModal />
    </div>
  )
}
