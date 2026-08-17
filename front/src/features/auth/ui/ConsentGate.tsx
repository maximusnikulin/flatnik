import { useQuery } from '@tanstack/react-query'
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../../../shared/lib/contacts'
import { useAuthStore } from '../model/auth.store'
import { useSignOut } from '../model/use-sign-out'
import { meQuery, useAcceptConsentMutation } from '../api/auth.api'

/**
 * Блокирующее окно согласия.
 *
 * Появляется у всех, кто вошёл, но условий не принимал, — включая аккаунты,
 * заведённые до появления согласия: у них `consentAccepted` тоже false.
 * Закрыть окно нельзя ничем, кроме выбора: ни кликом по фону, ни крестиком.
 * Отказ означает выход из аккаунта — продолжать обработку данных без
 * согласия мы не вправе.
 *
 * Живёт в фиче входа, а не рядом с текстами документов: работает оно с
 * профилем и сессией, а от юридической части ему нужны только адреса PDF.
 *
 * Пока профиль грузится, окна нет: показывать блокирующий запрос человеку,
 * который, возможно, уже всё принял, — хуже, чем секунда ожидания.
 */
export function ConsentGate() {
  const token = useAuthStore((s) => s.token)
  const me = useQuery(meQuery(Boolean(token)))
  const acceptConsent = useAcceptConsentMutation()
  const signOut = useSignOut()

  if (!token || me.data === undefined || me.data.consentAccepted) return null

  return (
    <div className="modal-overlay">
      <div className="modal -narrow">
        <header className="modal__header">
          <h2>Примите условия</h2>
        </header>
        <div className="modal__body">
          <p className="panel-note">
            Чтобы пользоваться Квартирником, нужно принять{' '}
            <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer">
              пользовательское соглашение
            </a>{' '}
            и дать согласие на{' '}
            <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
              обработку персональных данных
            </a>
            .
          </p>
          <p className="panel-note">
            Согласие можно отозвать в любой момент — тогда аккаунт будет удалён.
          </p>
          {acceptConsent.error && <p className="form-error">{acceptConsent.error.message}</p>}
          <button
            type="button"
            className="btn-primary"
            onClick={() => acceptConsent.mutate()}
            disabled={acceptConsent.isPending}
          >
            {acceptConsent.isPending ? 'Сохраняем…' : 'Принимаю'}
          </button>
          <button type="button" className="btn-link" onClick={signOut}>
            Не принимаю и выйти
          </button>
        </div>
      </div>
    </div>
  )
}
