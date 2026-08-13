import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCaptcha } from '../../../shared/lib/use-captcha'
import { formatPhone, isPhoneComplete, toE164 } from '../../../shared/lib/phone'
import { PhoneInput } from '../../../shared/ui/PhoneInput'
import { useAuthStore } from '../model/auth.store'
import {
  meQuery,
  useRequestCodeMutation,
  useSetNicknameMutation,
  useVerifyCodeMutation,
} from '../api/auth.api'

/**
 * Вход по телефону: телефон → код из Telegram → никнейм.
 *
 * Третий шаг обязателен и появляется не только сразу после регистрации:
 * ник выдаётся автоматически, а флаг nicknameConfirmed остаётся false, пока
 * человек не выберет своё имя. Поэтому при заходе на сайт с уже сохранённым
 * токеном модалка открывается сама и закрыть её нельзя.
 */
export function AuthModal() {
  const isModalOpen = useAuthStore((s) => s.isModalOpen)
  const closeModal = useAuthStore((s) => s.closeModal)
  const token = useAuthStore((s) => s.token)

  const me = useQuery(meQuery(Boolean(token)))
  const mustChooseNickname = Boolean(token) && me.data !== undefined && !me.data.nicknameConfirmed

  // Телефон храним десятью цифрами без кода страны — ровно то, что даёт маска
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')

  const requestCode = useRequestCodeMutation()
  const verifyCode = useVerifyCodeMutation()
  const setNicknameMutation = useSetNicknameMutation()
  const captcha = useCaptcha()

  // Подставляем выданный автоматически ник — его видно и можно оставить как есть.
  // Один раз на пользователя: иначе очищённое поле тут же заполнялось бы снова.
  const prefilledFor = useRef<string | null>(null)
  useEffect(() => {
    if (mustChooseNickname && me.data && prefilledFor.current !== me.data.id) {
      prefilledFor.current = me.data.id
      setNickname(me.data.nickname)
    }
  }, [mustChooseNickname, me.data])

  if (!isModalOpen && !mustChooseNickname) return null

  // Пока показывается задание капчи, запроса ещё нет — но кнопку уже держим
  // заблокированной, иначе второй клик откроет второе задание
  const isRequesting = captcha.isRunning || requestCode.isPending
  const canRequest = !isRequesting && isPhoneComplete(phone)
  const requestLabel = captcha.isRunning
    ? 'Подтвердите, что вы не робот'
    : requestCode.isPending
      ? 'Отправляем…'
      : 'Получить код'

  // Капча до запроса кода: она защищает от спама SMS, поэтому задание должно
  // быть пройдено раньше, чем бэкенд возьмётся генерировать код
  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault()

    const captchaResult = await captcha.getToken()
    if (!captchaResult.ok) return

    requestCode.mutate(
      { phone: toE164(phone), captchaToken: captchaResult.token },
      {
        onSuccess: () => {
          setStep('code')
          verifyCode.reset()
        },
      },
    )
  }

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault()
    verifyCode.mutate(
      { phone: toE164(phone), code },
      {
        onSuccess: (data) => {
          setPhone('')
          setCode('')
          setStep('phone')
          // Новому пользователю ник ещё выбирать: модалка останется открытой
          // на третьем шаге, её удержит mustChooseNickname
          if (data.user.nicknameConfirmed) closeModal()
        },
      },
    )
  }

  const handleNickname = (event: React.FormEvent) => {
    event.preventDefault()
    setNicknameMutation.mutate({ nickname }, { onSuccess: () => closeModal() })
  }

  // Закрыть можно всё, кроме обязательного выбора ника
  const dismiss = mustChooseNickname ? undefined : closeModal

  if (mustChooseNickname) {
    return (
      <div className="modal-overlay">
        <div className="modal -narrow">
          <header className="modal__header">
            <h2>Выберите никнейм</h2>
          </header>
          <form onSubmit={handleNickname} className="modal__body">
            <p className="panel-note">
              Им будут подписаны ваши отзывы. Телефон никому не показывается.
              Сейчас у вас временный ник, выданный автоматически.
            </p>
            <label className="field">
              <span className="field__label">Никнейм</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="maxim_n"
                minLength={3}
                maxLength={20}
                autoFocus
                required
              />
            </label>
            {setNicknameMutation.error && (
              <p className="form-error">{setNicknameMutation.error.message}</p>
            )}
            <button type="submit" className="btn-primary" disabled={setNicknameMutation.isPending}>
              {setNicknameMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal -narrow" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h2>Вход по телефону</h2>
          <button type="button" className="modal__close" onClick={dismiss} aria-label="Закрыть">
            ✕
          </button>
        </header>

        {step === 'phone' ? (
          <form onSubmit={handleRequest} className="modal__body">
            <label className="field">
              <span className="field__label">Телефон</span>
              <PhoneInput value={phone} onChange={setPhone} autoFocus required />
            </label>
            {captcha.isDisabled && (
              <p className="panel-note -error">
                Капча выключена: не задан <code>VITE_SMARTCAPTCHA_CLIENT_KEY</code>. Код
                отправляется без проверки.
              </p>
            )}
            <div className="captcha-slot" ref={captcha.containerRef} />
            {captcha.errorMessage && <p className="form-error">{captcha.errorMessage}</p>}
            {requestCode.error && <p className="form-error">{requestCode.error.message}</p>}
            <button type="submit" className="btn-primary" disabled={!canRequest}>
              {requestLabel}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="modal__body">
            <p className="panel-note">
              Отправили код в Telegram на {formatPhone(phone)}.
            </p>
            <label className="field">
              <span className="field__label">Код из Telegram</span>
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
