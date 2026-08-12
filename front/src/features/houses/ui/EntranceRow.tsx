import type { EntranceGroup } from '../lib/group-by-entrance'

interface EntranceRowProps {
  group: EntranceGroup
  onClick: () => void
}

/** Строка списка подъездов: номер, число квартир и счётчики отзывов */
export function EntranceRow({ group, onClick }: EntranceRowProps) {
  const apartmentCount = group.apartments.length

  return (
    <button type="button" className="apartment-row" onClick={onClick}>
      <span className="apartment-row__main">
        <span className="apartment-row__number">Подъезд {group.entrance}</span>
        <span className="apartment-row__caption">
          {apartmentCount} {pluralizeApartments(apartmentCount)}
        </span>
      </span>
      <span className="apartment-row__badges">
        {group.confirmedCount > 0 && <span className="badge -confirmed">{group.confirmedCount}</span>}
        {group.pendingCount > 0 && <span className="badge -pending">{group.pendingCount}</span>}
        <span className="apartment-row__chevron" aria-hidden>
          ›
        </span>
      </span>
    </button>
  )
}

/** 1 квартира, 2 квартиры, 5 квартир */
function pluralizeApartments(count: number): string {
  const tail = count % 100
  if (tail >= 11 && tail <= 14) return 'квартир'
  switch (count % 10) {
    case 1:
      return 'квартира'
    case 2:
    case 3:
    case 4:
      return 'квартиры'
    default:
      return 'квартир'
  }
}
