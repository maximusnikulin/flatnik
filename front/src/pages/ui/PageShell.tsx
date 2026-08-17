import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../shared/ui/Logo'

export interface Crumb {
  title: string
  /** Последняя крошка — текущая страница, ссылки у неё нет */
  to?: string
}

/**
 * Каркас страницы каталога: обычный поток документа, без слоя поверх карты.
 * Карта здесь намеренно не монтируется — скрипт Яндекса весит около мегабайта
 * и тормозил бы самый частый вход из поиска.
 */
export function PageShell({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page__top">
        {/* Тот же логотип, что рисует renderPage на сервере: без него название
            сервиса пропадало из шапки, как только клиент заменял серверный
            рендер своим */}
        <Logo className="page__logo" />
        {/* Крошки — настоящие ссылки: по ним ходит и человек, и поисковый робот */}
        <nav className="page__crumbs" aria-label="Хлебные крошки">
          {crumbs.map((crumb, index) => (
            <span key={crumb.title}>
              {index > 0 && <span className="page__crumb-sep">/</span>}
              {crumb.to ? (
                <Link to={crumb.to}>{crumb.title}</Link>
              ) : (
                <span aria-current="page">{crumb.title}</span>
              )}
            </span>
          ))}
        </nav>
      </header>
      <main className="page__body">{children}</main>
    </div>
  )
}

/** Форма слова по числу: [1, 2–4, 5–20] — «отзыв, отзыва, отзывов» */
function plural(count: number, forms: [string, string, string]): string {
  const tens = count % 100
  const ones = count % 10
  if (tens >= 11 && tens <= 14) return forms[2]
  if (ones === 1) return forms[0]
  if (ones >= 2 && ones <= 4) return forms[1]
  return forms[2]
}

export function reviewsWord(count: number): string {
  return plural(count, ['отзыв', 'отзыва', 'отзывов'])
}

export function housesWord(count: number): string {
  return plural(count, ['доме', 'домах', 'домах'])
}

export function apartmentsWord(count: number): string {
  return plural(count, ['квартире', 'квартирах', 'квартирах'])
}

export function streetsWord(count: number): string {
  return plural(count, ['улице', 'улицам', 'улицам'])
}

/** Средняя оценка для показа: «4,3» */
export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',')
}
