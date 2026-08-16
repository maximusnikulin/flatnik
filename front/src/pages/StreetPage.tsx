import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { streetQuery } from '../features/catalog/api/catalog.api'
import { ApiError } from '../shared/api/fetcher'
import { cityIn } from '../shared/lib/city-case'
import { cityUrl } from '../shared/lib/house-url'
import { useDocumentMeta } from '../shared/lib/use-document-meta'
import { NotFoundPage } from './NotFoundPage'
import { PageShell, formatRating, housesWord, reviewsWord } from './ui/PageShell'

/** Дома улицы, о которых есть отзывы */
export function StreetPage() {
  const { citySlug = '', streetSlug = '' } = useParams()
  const { data, isPending, error } = useQuery(streetQuery(citySlug, streetSlug))

  const streetName = data?.streetName ?? streetSlug
  const cityName = data?.cityName ?? citySlug
  useDocumentMeta({
    title: `${streetName}, ${cityName} — отзывы о съёмных квартирах`,
    description: data
      ? `Отзывы жильцов о ${data.houseCount} ${housesWord(data.houseCount)} на улице ${streetName} в ${cityIn(cityName)}.`
      : `Отзывы жильцов о домах на улице ${streetName}.`,
    canonicalPath: `/${citySlug}/${streetSlug}`,
  })

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />
  }

  const crumbs = [
    { title: 'Главная', to: '/' },
    { title: cityName, to: cityUrl(citySlug) },
    { title: streetName },
  ]

  return (
    <PageShell crumbs={crumbs}>
      <h1>
        {streetName}, {cityName} — отзывы жильцов
      </h1>

      {isPending && <p className="page__note">Загружаем…</p>}
      {error && !(error instanceof ApiError && error.status === 404) && (
        <p className="page__note -error">{error.message}</p>
      )}

      {data && (
        <>
          <p className="page__summary">
            {data.reviewCount} {reviewsWord(data.reviewCount)} о {data.houseCount}{' '}
            {housesWord(data.houseCount)}
            {data.ratingAvg !== null && ` · средняя оценка ${formatRating(data.ratingAvg)}`}
          </p>
          <ul className="page__list">
            {data.houses.map((house) => (
              <li key={house.id}>
                <Link className="page__row" to={`/${citySlug}/${streetSlug}/${house.houseSlug}`}>
                  <span className="page__row-title">
                    {streetName}, {house.houseNumber}
                  </span>
                  <span className="page__row-meta">
                    {house.reviewCount} {reviewsWord(house.reviewCount)}
                    {house.ratingAvg !== null && ` · ${formatRating(house.ratingAvg)}`}
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
