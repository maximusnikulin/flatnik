import { Outlet } from 'react-router-dom'
import { AuthModal } from '../features/auth/ui/AuthModal'
import { useMetricaPageview } from '../shared/lib/use-metrica-pageview'

/**
 * Общая обвязка всех страниц. Модалка входа живёт здесь: войти можно с любой
 * страницы, и её состояние не должно теряться при переходе между ними.
 */
export function Layout() {
  useMetricaPageview()

  return (
    <>
      <Outlet />
      <AuthModal />
    </>
  )
}
