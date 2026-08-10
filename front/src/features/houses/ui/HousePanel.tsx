import { useQuery } from '@tanstack/react-query'
import type { ApartmentSummary } from '@flatnik/shared'
import { houseByAddressQuery } from '../api/houses.api'
import { ApartmentRow } from './ApartmentRow'

interface HousePanelProps {
  address: string
  onSelectApartment: (apartment: ApartmentSummary) => void
  onAddReview: () => void
}

/** Панель «Квартиры»: список квартир дома, по которым есть отзывы */
export function HousePanel({ address, onSelectApartment, onAddReview }: HousePanelProps) {
  const { data, isPending, error } = useQuery(houseByAddressQuery(address))

  return (
    <section className="floating-panel">
      <h2 className="panel-title">Квартиры</h2>

      {isPending && <p className="panel-note">Загружаем…</p>}
      {error && <p className="panel-note -error">Не удалось загрузить квартиры: {error.message}</p>}
      {data &&
        (data.house === null || data.house.apartments.length === 0 ? (
          <p className="panel-note">
            По этому дому отзывов ещё нет. Оставьте первый — расскажите, как вам жилось.
          </p>
        ) : (
          <div className="panel-list">
            {data.house.apartments.map((apartment) => (
              <ApartmentRow
                key={apartment.id}
                apartment={apartment}
                onClick={() => onSelectApartment(apartment)}
              />
            ))}
          </div>
        ))}

      <button type="button" className="btn-primary" onClick={onAddReview}>
        Добавить отзыв
      </button>
    </section>
  )
}
