import { useState } from 'react'
import { useAuthStore } from '../model/auth.store'
import { useRequestCodeMutation, useVerifyCodeMutation } from '../api/auth.api'

/** Двухшаговая модалка входа: телефон → код из лога бэкенда */
export function AuthModal() {
  const isOpen = useAuthStore((s) => s.isModalOpen)
  const closeModal = useAuthStore((s) => s.closeModal)

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')

  const requestCode = useRequestCodeMutation()
  const verifyCode = useVerifyCodeMutation()

  if (!isOpen) return null

  const handleRequest = (event: React.FormEvent) => {
    event.preventDefault()
    requestCode.mutate(phone, {
      onSuccess: () => {
        setStep('code')
        verifyCode.reset()
      },
    })
  }

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault()
    verifyCode.mutate(
      { phone, code },
      {
        onSuccess: () => {
          setPhone('')
          setCode('')
          setStep('phone')
          closeModal()
        },
      },
    )
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal -narrow" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h2>Вход по телефону</h2>
          <button type="button" className="modal__close" onClick={closeModal} aria-label="Закрыть">
            ✕
          </button>
        </header>

        {step === 'phone' ? (
          <form onSubmit={handleRequest} className="modal__body">
            <label className="field">
              <span className="field__label">Телефон</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 999 123-45-67"
                autoFocus
                required
              />
            </label>
            {requestCode.error && <p className="form-error">{requestCode.error.message}</p>}
            <button type="submit" className="btn-primary" disabled={requestCode.isPending}>
              {requestCode.isPending ? 'Отправляем…' : 'Получить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="modal__body">
            <p className="panel-note">
              SMS пока не отправляются: код напечатан в логе бэкенда
              (<code>docker compose logs back</code> или терминал <code>npm run dev</code>).
            </p>
            <label className="field">
              <span className="field__label">Код из лога</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                pattern="\d{6}"
                autoFocus
                required
              />
            </label>
            {verifyCode.error && <p className="form-error">{verifyCode.error.message}</p>}
            <button type="submit" className="btn-primary" disabled={verifyCode.isPending}>
              {verifyCode.isPending ? 'Проверяем…' : 'Войти'}
            </button>
            <button type="button" className="btn-link" onClick={() => setStep('phone')}>
              Изменить телефон
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
