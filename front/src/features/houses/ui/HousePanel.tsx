import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ApartmentSummary, HouseSlugs } from '@flatnik/shared'
import { houseByAddressQuery } from '../api/houses.api'
import { houseUrl } from '../../../shared/lib/house-url'
import { ShareButton } from '../../../shared/ui/ShareButton'
import { groupByEntrance } from '../lib/group-by-entrance'
import { ApartmentRow } from './ApartmentRow'
import { EntranceRow } from './EntranceRow'

interface HousePanelProps {
  address: string
  /** Выбранный подъезд; null — показываем список подъездов */
  entrance: string | null
  onSelectEntrance: (entrance: string) => void
  onBackToEntrances: () => void
  onSelectApartment: (apartment: ApartmentSummary) => void
  /** Переход на публичную страницу дома со всеми его отзывами */
  onOpenHousePage: (slug: HouseSlugs) => void
  onAddReview: () => void
}

/** Панель дома: сначала подъезды, затем квартиры выбранного подъезда */
export function HousePanel({
  address,
  entrance,
  onSelectEntrance,
  onBackToEntrances,
  onSelectApartment,
  onOpenHousePage,
  onAddReview,
}: HousePanelProps) {
  const { data, isPending, error } = useQuery(houseByAddressQuery(address))

  const apartments = data?.house?.apartments
  const entrances = useMemo(() => groupByEntrance(apartments ?? []), [apartments])
  // Подъезд может исчезнуть из ответа после инвалидации — тогда возвращаемся к списку
  const currentGroup = entrance === null ? null : entrances.find((g) => g.entrance === entrance)

  return (
    <section className="floating-panel">
      {entrance !== null && (
        <button type="button" className="back-link" onClick={onBackToEntrances}>
          ← Все подъезды
        </button>
      )}
      <h2 className="panel-title">{entrance === null ? 'Подъезды' : `Подъезд ${entrance}`}</h2>

      {isPending && <p className="panel-note">Загружаем…</p>}
      {error && <p className="panel-note -error">Не удалось загрузить квартиры: {error.message}</p>}

      {data &&
        (entrances.length === 0 ? (
          <p className="panel-note">
            По этому дому отзывов ещё нет. Оставьте первый — расскажите, как вам жилось.
          </p>
        ) : entrance === null ? (
          <div className="panel-list">
            {entrances.map((group) => (
              <EntranceRow
                key={group.entrance}
                group={group}
                onClick={() => onSelectEntrance(group.entrance)}
              />
            ))}
          </div>
        ) : currentGroup ? (
          <div className="panel-list">
            {currentGroup.apartments.map((apartment) => (
              <ApartmentRow
                key={apartment.id}
                apartment={apartment}
                onClick={() => onSelectApartment(apartment)}
              />
            ))}
          </div>
        ) : (
          <p className="panel-note">В этом подъезде больше нет квартир с отзывами.</p>
        ))}

      {/* Слаги приходят с бэкенда; их нет у домов с неразобранным адресом —
          тогда публичной страницы просто не существует, и делиться нечем */}
      {data?.house?.slug && entrances.length > 0 && (
        <div className="panel-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenHousePage(data.house!.slug!)}
          >
            Все отзывы о доме
          </button>
          {/* Путь задан явно: на карте в адресной строке всегда «/», и без него
              кнопка поделилась бы главной вместо этого дома */}
          <ShareButton title={`${address} — отзывы жильцов`} path={houseUrl(data.house.slug)} />
        </div>
      )}

      <button type="button" className="btn-primary" onClick={onAddReview}>
        Добавить отзыв
      </button>
    </section>
  )
}
