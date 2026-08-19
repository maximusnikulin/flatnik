import { useState } from 'react'
import { ApiError } from '../../../shared/api/fetcher'
import {
  useRequestEmailCodeMutation,
  useVerifyEmailMutation,
} from '../../auth/api/auth.api'

/**
 * Подтверждение почты внутри формы отзыва: адрес → код из письма → привязка
 * к аккаунту. Нужно аккаунтам без почты — заведённым по телефону, пока вход
 * по нему был в форме: решение модератора уходит
 * письмом, и без почты отзыв не принимается.
 *
 * Своё состояние держит здесь, а не в сторе черновика: оно живёт ровно один
 * заход и к самому отзыву отношения не имеет. Успешное подтверждение
 * обновляет профиль в кеше, и родитель убирает этот блок сам.
 */
export function EmailConfirmField() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  /** Код отправлен — показываем поле ввода. Обратно не возвращаемся: адрес
   *  меняется правкой поля, и тогда код запрашивается заново */
  const [isSent, setSent] = useState(false)

  const requestCode = useRequestEmailCodeMutation()
  const verifyEmail = useVerifyEmailMutation()

  /**
   * 429 — это не отказ, а «код уже отправлен»: попытка живёт пять минут,
   * а пауза между запросами всего минуту, поэтому в момент отказа письмо
   * у человека на руках и ему не хватает только поля для ввода. Открываем
   * его так же, как при успешной отправке.
   */
  const isThrottled = requestCode.error instanceof ApiError && requestCode.error.status === 429

  const handleRequest = () => {
    requestCode.mutate(
      { email },
      {
        onSuccess: () => setSent(true),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 429) setSent(true)
        },
      },
    )
  }

  const handleVerify = () => {
    verifyEmail.mutate({ email, code })
  }

  return (
    <div className="field">
      <span className="field__label">Почта для ответа</span>
      <p className="panel-note">
        На неё придёт решение модератора. Без подтверждённой почты отзыв
        отправить нельзя.
      </p>
      <div className="field-row">
        <input
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            // Адрес поменяли — прежний код к нему не подходит
            setSent(false)
            setCode('')
          }}
          type="email"
          inputMode="email"
          placeholder="me@example.com"
          aria-label="Почта для ответа"
          required
        />
        <button
          type="button"
          className="btn-link"
          onClick={handleRequest}
          disabled={requestCode.isPending || email === ''}
        >
          {requestCode.isPending ? 'Отправляем…' : isSent ? 'Прислать ещё раз' : 'Подтвердить'}
        </button>
      </div>
      {/* Сообщение о паузе полезно — оно говорит, когда можно запросить новый
          код, — поэтому идёт заметкой, а не ошибкой */}
      {requestCode.error && (
        <p className={isThrottled ? 'panel-note' : 'form-error'}>{requestCode.error.message}</p>
      )}

      {isSent && (
        <>
          <p className="panel-note">Отправили код на {email}.</p>
          <div className="field-row">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              inputMode="numeric"
              pattern="\d{6}"
              aria-label="Код из письма"
              autoFocus
            />
            <button
              type="button"
              className="btn-link"
              onClick={handleVerify}
              disabled={verifyEmail.isPending || code === ''}
            >
              {verifyEmail.isPending ? 'Проверяем…' : 'Готово'}
            </button>
          </div>
          {verifyEmail.error && <p className="form-error">{verifyEmail.error.message}</p>}
        </>
      )}
    </div>
  )
}
