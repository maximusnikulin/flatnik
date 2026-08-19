import { Outlet } from 'react-router-dom'
import { AuthModal } from '../features/auth/ui/AuthModal'
import { CookieBanner } from '../features/legal/ui/CookieBanner'
import { WelcomeModal } from '../features/welcome'
import { useMetricaPageview } from '../shared/lib/use-metrica-pageview'

/**
 * Общая обвязка всех страниц. Модалка входа живёт здесь: войти можно с любой
 * страницы, и её состояние не должно теряться при переходе между ними.
 *
 * Баннер о cookie — тоже: спрашивают о них до входа и на любой странице, куда
 * бы посетитель ни попал из поиска.
 *
 * Приветственная модалка показывается один раз при первом заходе.
 */
export function Layout() {
  useMetricaPageview()

  return (
    <>
      <Outlet />
      <WelcomeModal />
      <AuthModal />
      <CookieBanner />
    </>
  )
}
