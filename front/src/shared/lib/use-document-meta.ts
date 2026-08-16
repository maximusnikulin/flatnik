import { useEffect } from 'react'

interface DocumentMeta {
  title: string
  description: string
  /** Путь без домена; canonical собирается от текущего origin */
  canonicalPath: string
  /** Страница не должна попадать в индекс: например, у дома нет отзывов */
  noindex?: boolean
}

/** Ставит или создаёт одиночный тег в head */
function setTag(selector: string, create: () => HTMLElement, apply: (tag: HTMLElement) => void) {
  let tag = document.head.querySelector<HTMLElement>(selector)
  if (!tag) {
    tag = create()
    document.head.appendChild(tag)
  }
  apply(tag)
}

/**
 * Мета текущей страницы при клиентской навигации.
 *
 * Для поисковика решающая мета — та, что подставил бэкенд в HTML; здесь она
 * поддерживается в актуальном виде для переходов внутри приложения, шеринга
 * ссылок и вкладок браузера. Восстанавливать значения при размонтировании не
 * нужно: следующая страница их перезапишет.
 */
export function useDocumentMeta({ title, description, canonicalPath, noindex }: DocumentMeta) {
  useEffect(() => {
    document.title = title

    setTag(
      'meta[name="description"]',
      () => {
        const tag = document.createElement('meta')
        tag.setAttribute('name', 'description')
        return tag
      },
      (tag) => tag.setAttribute('content', description),
    )

    setTag(
      'link[rel="canonical"]',
      () => {
        const tag = document.createElement('link')
        tag.setAttribute('rel', 'canonical')
        return tag
      },
      (tag) => tag.setAttribute('href', `${window.location.origin}${canonicalPath}`),
    )

    // Тег robots держим только пока он нужен: оставшийся noindex закрыл бы от
    // индексации следующую страницу, на которую перейдёт пользователь
    const robots = document.head.querySelector('meta[name="robots"]')
    if (noindex) {
      if (robots) {
        robots.setAttribute('content', 'noindex, follow')
      } else {
        const tag = document.createElement('meta')
        tag.setAttribute('name', 'robots')
        tag.setAttribute('content', 'noindex, follow')
        document.head.appendChild(tag)
      }
    } else if (robots) {
      robots.remove()
    }
  }, [title, description, canonicalPath, noindex])
}
