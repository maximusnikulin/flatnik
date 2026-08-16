import type { HouseSlugs } from '@flatnik/shared'

/**
 * Ссылки на страницы каталога. Слаги всегда приходят с бэкенда: он их
 * придумал, он же разрешил коллизии — свой вариант транслитерации фронт
 * считать не должен, иначе ссылка уведёт на 404.
 */
export function cityUrl(citySlug: string): string {
  return `/${citySlug}`
}

export function streetUrl(citySlug: string, streetSlug: string): string {
  return `/${citySlug}/${streetSlug}`
}

export function houseUrl(slug: HouseSlugs): string {
  return `/${slug.citySlug}/${slug.streetSlug}/${slug.houseSlug}`
}
