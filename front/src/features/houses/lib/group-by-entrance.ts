import type { ApartmentSummary } from '@flatnik/shared'

/** Подъезд дома с квартирами и суммой подтверждённых отзывов по ним */
export interface EntranceGroup {
  entrance: string
  apartments: ApartmentSummary[]
  confirmedCount: number
}

/**
 * Подъезды человеку привычнее видеть по номеру: 2 раньше 10. Нечисловые
 * обозначения («2А», «левый») сортируются по алфавиту и идут после числовых.
 */
function compareEntrances(a: string, b: string): number {
  const left = Number(a)
  const right = Number(b)
  const isLeftNumeric = a.trim() !== '' && Number.isFinite(left)
  const isRightNumeric = b.trim() !== '' && Number.isFinite(right)
  if (isLeftNumeric && isRightNumeric) return left - right
  if (isLeftNumeric) return -1
  if (isRightNumeric) return 1
  return a.localeCompare(b, 'ru')
}

/**
 * Группирует квартиры дома по подъездам. Порядок квартир внутри подъезда
 * сохраняется — бэкенд уже отдаёт их по-человечески отсортированными.
 */
export function groupByEntrance(apartments: ApartmentSummary[]): EntranceGroup[] {
  const groups = new Map<string, EntranceGroup>()

  for (const apartment of apartments) {
    const group = groups.get(apartment.entrance)
    if (group) {
      group.apartments.push(apartment)
      group.confirmedCount += apartment.confirmedCount
    } else {
      groups.set(apartment.entrance, {
        entrance: apartment.entrance,
        apartments: [apartment],
        confirmedCount: apartment.confirmedCount,
      })
    }
  }

  return [...groups.values()].sort((a, b) => compareEntrances(a.entrance, b.entrance))
}
