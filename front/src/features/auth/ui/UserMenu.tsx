import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../shared/api/fetcher'
import { queryKeyRoots } from '../../../shared/api/keys'
import { useAuthStore } from '../model/auth.store'
import { meQuery } from '../api/auth.api'

/** Правый верхний угол: кнопка входа или ник вошедшего пользователя */
export function UserMenu() {
  const token = useAuthStore((s) => s.token)
  const openModal = useAuthStore((s) => s.openModal)
  const setToken = useAuthStore((s) => s.setToken)
  const queryClient = useQueryClient()

  const me = useQuery(meQuery(Boolean(token)))

  const signOut = () => {
    setToken(null)
    // Профиль в кеше принадлежал прежнему токену
    queryClient.removeQueries({ queryKey: queryKeyRoots.auth })
  }

  if (!token) {
    return (
      <button type="button" className="user-menu__enter" onClick={openModal}>
        Войти
      </button>
    )
  }

  if (me.isPending) {
    return <div className="user-menu user-menu--muted">Загружаем профиль…</div>
  }

  if (me.error) {
    // Просроченный или отозванный токен: сам он не починится, поэтому
    // предлагаем выйти, а не молча показываем пустую панель
    const expired = me.error instanceof ApiError && me.error.status === 401
    return (
      <div className="user-menu user-menu--error">
        <span>{expired ? 'Сессия истекла' : 'Профиль недоступен'}</span>
        <button type="button" className="btn-link" onClick={signOut}>
          Выйти
        </button>
      </div>
    )
  }

  return (
    <div className="user-menu">
      <span className="user-menu__nickname" title={me.data.phone}>
        {me.data.nickname}
      </span>
      <button type="button" className="btn-link" onClick={signOut}>
        Выйти
      </button>
    </div>
  )
}
