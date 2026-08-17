import { Outlet } from 'react-router-dom'
import { AuthModal } from '../features/auth/ui/AuthModal'
import { ConsentGate } from '../features/auth/ui/ConsentGate'
import { useMetricaPageview } from '../shared/lib/use-metrica-pageview'

/**
 * Общая обвязка всех страниц. Модалка входа живёт здесь: войти можно с любой
 * страницы, и её состояние не должно теряться при переходе между ними.
 *
 * Окно согласия — тоже: без принятых условий работать с сайтом нельзя ни на
 * карте, ни в каталоге. Оно объявлено после AuthModal, чтобы при равных
 * z-index оказаться сверху; шаг выбора ника при непринятом согласии
 * подавляется в самой AuthModal.
 */
export function Layout() {
  useMetricaPageview()

  return (
    <>
      <Outlet />
      <AuthModal />
      <ConsentGate />
    </>
  )
}
