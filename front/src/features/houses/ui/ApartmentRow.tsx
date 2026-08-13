import type { ApartmentSummary } from '@flatnik/shared'

interface ApartmentRowProps {
  apartment: ApartmentSummary
  onClick: () => void
}

/** Строка списка квартир: номер и число подтверждённых отзывов */
export function ApartmentRow({ apartment, onClick }: ApartmentRowProps) {
  return (
    <button type="button" className="apartment-row" onClick={onClick}>
      <span className="apartment-row__number">{apartment.number}</span>
      <span className="apartment-row__badges">
        {apartment.confirmedCount > 0 && (
          <span className="badge -confirmed">{apartment.confirmedCount}</span>
        )}
      </span>
    </button>
  )
}
