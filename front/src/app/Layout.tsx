import { Outlet } from 'react-router-dom'
import { AuthModal } from '../features/auth/ui/AuthModal'

/**
 * Общая обвязка всех страниц. Модалка входа живёт здесь: войти можно с любой
 * страницы, и её состояние не должно теряться при переходе между ними.
 */
export function Layout() {
  return (
    <>
      <Outlet />
      <AuthModal />
    </>
  )
}
