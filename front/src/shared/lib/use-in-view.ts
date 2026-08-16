import { useCallback, useEffect, useState } from 'react'

/**
 * Показался ли элемент в области видимости хотя бы раз.
 *
 * Нужен, чтобы не грузить тяжёлое до того, как оно понадобилось: скрипт
 * Яндекс.Карт весит около мегабайта, и на странице дома он не должен попадать
 * в критический путь — посетитель из поиска пришёл читать отзывы.
 *
 * Элемент отслеживается через callback-ref, а не useRef: блок с картой
 * появляется только после загрузки данных, и обычный ref к моменту первого
 * эффекта был бы пустым, а повторно эффект уже не запустился бы.
 *
 * Флаг не сбрасывается: единожды показавшись, блок остаётся смонтированным,
 * иначе карта переинициализировалась бы при каждой прокрутке.
 */
export function useInView<T extends HTMLElement>(rootMargin = '200px') {
  const [element, setElement] = useState<T | null>(null)
  const [inView, setInView] = useState(false)

  const ref = useCallback((node: T | null) => setElement(node), [])

  useEffect(() => {
    if (!element || inView) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, inView, rootMargin])

  return { ref, inView }
}
