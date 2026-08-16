import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initMetrica, trackPageview } from './metrica'

/**
 * Отправляет просмотр страницы при загрузке и при каждом переходе.
 *
 * В одностраничном приложении адрес меняется без перезагрузки, поэтому сама
 * Метрика видит ровно один просмотр за сессию — переходы по каталогу иначе не
 * попали бы в отчёты вовсе.
 *
 * Первый просмотр отправляется отсюда же: счётчик инициализируется с defer,
 * то есть при init Метрика не шлёт ничего. Дубли отсекает trackPageview по
 * адресу, а не флагом «первый рендер» — под двойными эффектами StrictMode
 * такой флаг сбрасывался в dev и прятал потерю первого просмотра в проде.
 */
export function useMetricaPageview(): void {
  const location = useLocation()

  useEffect(() => {
    initMetrica()
  }, [])

  useEffect(() => {
    trackPageview(`${window.location.origin}${location.pathname}${location.search}`)
  }, [location.pathname, location.search])
}
