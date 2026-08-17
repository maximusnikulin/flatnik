import { useQueryClient } from '@tanstack/react-query'
import { queryKeyRoots } from '../../../shared/api/keys'
import { useAuthStore } from './auth.store'

/**
 * Выход из аккаунта. Вынесен из UserMenu, потому что выходов теперь два:
 * кнопка в меню и отказ принять условия в блокирующем окне. Забыть в одном
 * из них про очистку кеша — значит показать чужой профиль следующему входу.
 */
export function useSignOut(): () => void {
  const setToken = useAuthStore((s) => s.setToken)
  const queryClient = useQueryClient()

  return () => {
    setToken(null)
    // Профиль в кеше принадлежал прежнему токену
    queryClient.removeQueries({ queryKey: queryKeyRoots.auth })
  }
}
