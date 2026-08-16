import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { initMetrica, trackPageview } from './metrica'

/**
 * Отправляет просмотр страницы при каждом переходе.
 *
 * В одностраничном приложении адрес меняется без перезагрузки, поэтому сама
 * Метрика видит ровно один просмотр за сессию — переходы по каталогу иначе не
 * попали бы в отчёты вовсе.
 */
export function useMetricaPageview(): void {
  const location = useLocation()
  // Первый просмотр Метрика считает сама при init — дубль был бы лишним
  const isFirst = useRef(true)

  useEffect(() => {
    initMetrica()
  }, [])

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    trackPageview(`${window.location.origin}${location.pathname}${location.search}`)
  }, [location.pathname, location.search])
}
