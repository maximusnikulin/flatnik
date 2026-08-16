import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { citiesQuery } from '../features/catalog/api/catalog.api'
import { cityUrl } from '../shared/lib/house-url'
import { useDocumentMeta } from '../shared/lib/use-document-meta'
import { PageShell, reviewsWord } from './ui/PageShell'

/**
 * Страница не найдена. Список городов на ней не для вида: с тупика человек и
 * робот должны иметь куда пойти, иначе это тупик и для обхода сайта.
 */
export function NotFoundPage() {
  const { data } = useQuery(citiesQuery())

  useDocumentMeta({
    title: 'Страница не найдена — flatnik',
    description: 'Такой страницы нет. Выберите город и найдите дом на карте отзывов.',
    canonicalPath: '/',
    noindex: true,
  })

  return (
    <PageShell crumbs={[{ title: 'Главная', to: '/' }, { title: 'Страница не найдена' }]}>
      <h1>Такой страницы нет</h1>
      <p className="page__summary">
        Возможно, дом ещё не появился в каталоге: он попадает сюда после первого проверенного
        отзыва.
      </p>

      {data && data.length > 0 && (
        <>
          <h2>Города с отзывами</h2>
          <ul className="page__list">
            {data.map((city) => (
              <li key={city.citySlug}>
                <Link className="page__row" to={cityUrl(city.citySlug)}>
                  <span className="page__row-title">{city.cityName}</span>
                  <span className="page__row-meta">
                    {city.reviewCount} {reviewsWord(city.reviewCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link className="btn-secondary" to="/">
        Открыть карту
      </Link>
    </PageShell>
  )
}
