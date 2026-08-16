import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { cityQuery } from '../features/catalog/api/catalog.api'
import { ApiError } from '../shared/api/fetcher'
import { cityIn } from '../shared/lib/city-case'
import { streetUrl } from '../shared/lib/house-url'
import { useDocumentMeta } from '../shared/lib/use-document-meta'
import { NotFoundPage } from './NotFoundPage'
import { PageShell, formatRating, housesWord, reviewsWord, streetsWord } from './ui/PageShell'

/** Улицы города, где есть отзывы. Источник истины — слаг в адресе, не стор */
export function CityPage() {
  const { citySlug = '' } = useParams()
  const { data, isPending, error } = useQuery(cityQuery(citySlug))

  const cityName = data?.cityName ?? citySlug
  const inCity = cityIn(cityName)
  useDocumentMeta({
    title: `Отзывы о съёмных квартирах в ${inCity} — Квартирник`,
    description: data
      ? `${data.reviewCount} ${reviewsWord(data.reviewCount)} от бывших жильцов по ${data.streetCount} ${streetsWord(data.streetCount)} города ${cityName}.`
      : `Отзывы жильцов о съёмных квартирах в городе ${cityName}.`,
    canonicalPath: `/${citySlug}`,
  })

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />
  }

  const crumbs = [{ title: 'Главная', to: '/' }, { title: cityName }]

  return (
    <PageShell crumbs={crumbs}>
      <h1>Отзывы о съёмных квартирах в {inCity}</h1>

      {isPending && <p className="page__note">Загружаем…</p>}
      {error && !(error instanceof ApiError && error.status === 404) && (
        <p className="page__note -error">{error.message}</p>
      )}

      {data && (
        <>
          <p className="page__summary">
            {data.reviewCount} {reviewsWord(data.reviewCount)} о {data.houseCount}{' '}
            {housesWord(data.houseCount)}
          </p>
          <ul className="page__list">
            {data.streets.map((street) => (
              <li key={street.streetSlug}>
                <Link className="page__row" to={streetUrl(citySlug, street.streetSlug)}>
                  <span className="page__row-title">{street.streetName}</span>
                  <span className="page__row-meta">
                    {street.reviewCount} {reviewsWord(street.reviewCount)}
                    {street.ratingAvg !== null && ` · ${formatRating(street.ratingAvg)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}
