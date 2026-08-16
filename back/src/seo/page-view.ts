import { escapeAttr, escapeHtml } from './html.util'

/** Ссылка в списке или в хлебных крошках */
export interface PageLink {
  href: string
  title: string
  /** Приписка справа: число отзывов, оценка */
  meta?: string
}

/**
 * Разметка, которую видит поисковик и первый кадр у человека.
 *
 * Классы те же, что использует React: пока грузится бандл, страница выглядит
 * готовой, а не сломанной. Прятать эту разметку нельзя — скрытый от человека,
 * но отданный роботу текст и есть то, за что наказывают.
 */
export function renderList(items: PageLink[]): string {
  if (items.length === 0) {
    return ''
  }
  const rows = items
    .map(
      (item) => `<li><a class="page__row" href="${escapeAttr(item.href)}">
        <span class="page__row-title">${escapeHtml(item.title)}</span>
        ${item.meta ? `<span class="page__row-meta">${escapeHtml(item.meta)}</span>` : ''}
      </a></li>`,
    )
    .join('\n')
  return `<ul class="page__list">\n${rows}\n</ul>`
}

/** Хлебные крошки; последний элемент — текущая страница, без ссылки */
export function renderCrumbs(crumbs: PageLink[]): string {
  const parts = crumbs.map((crumb, index) => {
    const sep = index > 0 ? '<span class="page__crumb-sep">/</span>' : ''
    const body =
      index === crumbs.length - 1
        ? `<span aria-current="page">${escapeHtml(crumb.title)}</span>`
        : `<a href="${escapeAttr(crumb.href)}">${escapeHtml(crumb.title)}</a>`
    return `<span>${sep}${body}</span>`
  })
  return `<nav class="page__crumbs" aria-label="Хлебные крошки">${parts.join('')}</nav>`
}

/** Отзыв на странице дома: та же карточка, что рисует ReviewCard на клиенте */
export function renderReview(review: {
  authorName: string
  apartmentNumber: string
  entrance: string
  createdAt: string
  text: string
  rating: number | null
}): string {
  const date = review.createdAt.slice(0, 10)
  return `<article class="review-card">
  <p class="review-card__status -confirmed">✓ Отзыв подтверждён</p>
  <p class="review-card__header">
    <span class="review-card__author">${escapeHtml(review.authorName)}</span>
    <span class="review-card__place">кв. ${escapeHtml(review.apartmentNumber)}, подъезд ${escapeHtml(review.entrance)}</span>
    <time datetime="${escapeAttr(review.createdAt)}">${escapeHtml(formatDate(date))}</time>
  </p>
  ${review.rating === null ? '' : `<span class="rating-stars">${stars(review.rating)}</span>`}
  <p class="review-card__text">${escapeHtml(review.text)}</p>
</article>`
}

/** '2024-03-12' → '12.03.24': тот же формат, что и в карточке на клиенте */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year.slice(2)}`
}

function stars(rating: number): string {
  return Array.from({ length: 5 }, (_, index) =>
    index < rating
      ? '<span class="rating-stars__star -on">★</span>'
      : '<span class="rating-stars__star">★</span>',
  ).join('')
}

/** Каркас страницы каталога — та же структура, что рисует PageShell на клиенте */
export function renderPage(crumbs: PageLink[], body: string): string {
  return `<div class="page">
  <header class="page__top">
    <a class="page__logo" href="/">Квартирник</a>
    ${renderCrumbs(crumbs)}
  </header>
  <main class="page__body">
${body}
  </main>
</div>`
}
