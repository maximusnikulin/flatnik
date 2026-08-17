import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../../shared/api/fetcher'
import { useAuthStore } from '../model/auth.store'
import { useSignOut } from '../model/use-sign-out'
import { meQuery } from '../api/auth.api'

interface UserMenuProps {
  onOpenMyReviews: () => void
}

/** Правый верхний угол: кнопка входа или ник вошедшего пользователя */
export function UserMenu({ onOpenMyReviews }: UserMenuProps) {
  const token = useAuthStore((s) => s.token)
  const openModal = useAuthStore((s) => s.openModal)

  const me = useQuery(meQuery(Boolean(token)))
  const signOut = useSignOut()

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
      {/* В подсказке — то, чем вошли: телефон, почта или ничего, если ни того
          ни другого ещё нет (аккаунт всегда заведён чем-то одним) */}
      <span className="user-menu__nickname" title={me.data.phone ?? me.data.email ?? undefined}>
        {me.data.nickname}
      </span>
      <button type="button" className="btn-link" onClick={onOpenMyReviews}>
        Мои отзывы
      </button>
      <button type="button" className="btn-link" onClick={signOut}>
        Выйти
      </button>
    </div>
  )
}
