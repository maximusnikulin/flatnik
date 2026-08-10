import type { ApartmentSummary } from '@flatnik/shared'

interface ApartmentRowProps {
  apartment: ApartmentSummary
  onClick: () => void
}

/** Строка списка квартир: номер и счётчики подтверждённых/неподтверждённых */
export function ApartmentRow({ apartment, onClick }: ApartmentRowProps) {
  return (
    <button type="button" className="apartment-row" onClick={onClick}>
      <span className="apartment-row__number">{apartment.number}</span>
      <span className="apartment-row__badges">
        {apartment.confirmedCount > 0 && (
          <span className="badge -confirmed">{apartment.confirmedCount}</span>
        )}
        {apartment.pendingCount > 0 && (
          <span className="badge -pending">{apartment.pendingCount}</span>
        )}
      </span>
    </button>
  )
}
