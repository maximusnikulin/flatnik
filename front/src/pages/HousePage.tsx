import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { houseQuery } from '../features/catalog/api/catalog.api'
import { HouseMap } from '../features/map/ui/HouseMap'
import { useMapStore } from '../features/map/model/map.store'
import { ReviewCard, formatDate } from '../features/reviews/ui/ReviewCard'
import { ApiError } from '../shared/api/fetcher'
import { cityIn } from '../shared/lib/city-case'
import { cityUrl, streetUrl } from '../shared/lib/house-url'
import { useDocumentMeta } from '../shared/lib/use-document-meta'
import { useInView } from '../shared/lib/use-in-view'
import { RatingStars } from '../shared/ui/RatingStars'
import { NotFoundPage } from './NotFoundPage'
import { PageShell, apartmentsWord, formatRating, reviewsWord } from './ui/PageShell'

/** Дом со всеми подтверждёнными отзывами — главная посадочная страница */
export function HousePage() {
  const { citySlug = '', streetSlug = '', houseSlug = '' } = useParams()
  const navigate = useNavigate()
  const selectAddress = useMapStore((s) => s.selectAddress)
  const { data, isPending, error } = useQuery(houseQuery(citySlug, streetSlug, houseSlug))
  // Карта грузится, только когда до неё долистали: скрипт Яндекса тяжёлый, а
  // посетитель из поиска пришёл читать отзывы
  const map = useInView<HTMLDivElement>()

  const title = data ? `${data.streetName}, ${data.houseNumber}` : houseSlug
  useDocumentMeta({
    title:
      data && data.reviewCount > 0
        ? `${title}, ${data.cityName} — ${data.reviewCount} ${reviewsWord(data.reviewCount)} жильцов`
        : `${title}${data ? `, ${data.cityName}` : ''} — отзывы жильцов`,
    description: data
      ? describe(data.reviewCount, data.ratingAvg, title, data.cityName)
      : 'Отзывы жильцов о съёмной квартире.',
    canonicalPath: `/${citySlug}/${streetSlug}/${houseSlug}`,
    // Дом заведён, но подтверждённых отзывов нет: страница пуста для индекса,
    // при этом ссылки с неё роботу проходить можно
    noindex: data?.reviewCount === 0,
  })

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />
  }

  const crumbs = [
    { title: 'Главная', to: '/' },
    { title: data?.cityName ?? citySlug, to: cityUrl(citySlug) },
    { title: data?.streetName ?? streetSlug, to: streetUrl(citySlug, streetSlug) },
    { title: data?.houseNumber ?? houseSlug },
  ]

  return (
    <PageShell crumbs={crumbs}>
      <h1>
        {title} — отзывы жильцов
      </h1>

      {isPending && <p className="page__note">Загружаем…</p>}
      {error && !(error instanceof ApiError && error.status === 404) && (
        <p className="page__note -error">{error.message}</p>
      )}

      {data && (
        <>
          <p className="page__summary">
            {data.address}
            {data.ratingAvg !== null && (
              <>
                {' · '}
                <RatingStars value={Math.round(data.ratingAvg)} />{' '}
                {formatRating(data.ratingAvg)} из 5
              </>
            )}
          </p>

          <div className="house-map__slot" ref={map.ref}>
            {map.inView && <HouseMap lat={data.lat} lon={data.lon} address={data.address} />}
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              // Данные для карты уже пришли с этой же страницы — второй запрос
              // к геокодеру не нужен
              selectAddress({ address: data.address, lat: data.lat, lon: data.lon })
              navigate('/')
            }}
          >
            Открыть на большой карте
          </button>

          {data.apartments.length > 0 && (
            <>
              <h2>Квартиры с отзывами</h2>
              <ul className="page__list">
                {data.apartments.map((apartment) => (
                  <li key={apartment.id}>
                    {/* Якорь, а не ссылка: отзывы всех квартир уже на этой
                        странице, отдельных страниц у квартир нет */}
                    <a className="page__row" href={`#kv-${apartment.id}`}>
                      <span className="page__row-title">
                        Квартира {apartment.number}, подъезд {apartment.entrance}
                      </span>
                      <span className="page__row-meta">
                        {apartment.reviewCount} {reviewsWord(apartment.reviewCount)}
                        {apartment.ratingAvg !== null && ` · ${formatRating(apartment.ratingAvg)}`}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.reviewCount === 0 ? (
            <p className="page__note">
              Отзывы об этом доме пока на проверке — они появятся здесь после модерации.
            </p>
          ) : (
            <>
              <h2>
                {data.reviewCount} {reviewsWord(data.reviewCount)} о {data.apartments.length}{' '}
                {apartmentsWord(data.apartments.length)}
              </h2>
              <div className="page__reviews">
                {data.reviews.map((review, index) => (
                  <div
                    key={review.id}
                    // Якорь ставим на первый отзыв квартиры: на него ведут
                    // ссылки из списка квартир выше
                    id={
                      data.reviews.findIndex((r) => r.apartmentId === review.apartmentId) === index
                        ? `kv-${review.apartmentId}`
                        : undefined
                    }
                  >
                    <ReviewCard
                      review={review}
                      header={
                        <p className="review-card__header">
                          <span className="review-card__author">{review.authorName}</span>
                          <span className="review-card__place">
                            кв. {review.apartmentNumber}, подъезд {review.entrance}
                          </span>
                          <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                        </p>
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  )
}

/** Описание страницы: оценка вперёд, если она есть — в выдаче это заметнее */
function describe(
  reviewCount: number,
  ratingAvg: number | null,
  title: string,
  cityName: string,
): string {
  if (reviewCount === 0) {
    return `${title}, ${cityName}. Отзывы жильцов появятся после проверки модератором.`
  }
  const rating = ratingAvg === null ? '' : `Оценка ${formatRating(ratingAvg)} из 5. `
  return `${rating}${reviewCount} ${reviewsWord(reviewCount)} бывших жильцов о квартирах и подъездах: ${title}, ${cityIn(cityName)}.`
}
