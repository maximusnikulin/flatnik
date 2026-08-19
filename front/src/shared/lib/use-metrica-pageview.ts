import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsAnalyticsAllowed } from '../../features/legal/model/cookie-consent.store'
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
 *
 * Ничего не происходит, пока посетитель не согласился на аналитические
 * cookie: скрипт Метрики не грузится и хиты не уходят. Согласие посреди
 * сессии учитывается сразу — оно в зависимостях, поэтому текущая страница
 * попадёт в отчёты без ожидания следующего перехода.
 *
 * Обратный переход, из «принял» в «отклонил», останавливает хиты, но уже
 * загруженный скрипт со страницы не убирает: это делает перезагрузка.
 */
export function useMetricaPageview(): void {
  const location = useLocation()
  const isAnalyticsAllowed = useIsAnalyticsAllowed()

  useEffect(() => {
    if (isAnalyticsAllowed) {
      initMetrica()
    }
  }, [isAnalyticsAllowed])

  useEffect(() => {
    if (!isAnalyticsAllowed) return
    trackPageview(`${window.location.origin}${location.pathname}${location.search}`)
  }, [isAnalyticsAllowed, location.pathname, location.search])
}
