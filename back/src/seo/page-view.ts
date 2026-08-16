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

/** Каркас страницы каталога — та же структура, что рисует PageShell на клиенте */
export function renderPage(crumbs: PageLink[], body: string): string {
  return `<div class="page">
  <header class="page__top">
    <a class="page__logo" href="/">flatnik</a>
    ${renderCrumbs(crumbs)}
  </header>
  <main class="page__body">
${body}
  </main>
</div>`
}
