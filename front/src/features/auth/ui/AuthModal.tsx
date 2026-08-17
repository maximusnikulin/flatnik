import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCaptcha } from '../../../shared/lib/use-captcha'
import { formatPhone, isPhoneComplete, toE164 } from '../../../shared/lib/phone'
import { PhoneInput } from '../../../shared/ui/PhoneInput'
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../../../shared/lib/contacts'
import { useAuthStore } from '../model/auth.store'
import {
  authSessionQuery,
  meQuery,
  useAcceptSession,
  useRequestCodeMutation,
  useSetNicknameMutation,
  useVerifyCodeMutation,
} from '../api/auth.api'

/**
 * Вход по телефону: телефон → подтверждение → никнейм.
 *
 * Подтверждений два вида, и выбирает его провайдер уже после запроса, поэтому
 * второй шаг всегда начинается с ожидания. Мобильная авторизация приходит на
 * SIM-карту — вводить нечего, фронт опрашивает статус. Если SIM-PUSH не
 * сработал, провайдер присылает код в SMS и сообщает об этом статусом
 * `needs-code` — тогда шаг превращается в поле ввода.
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
  // Пока условия не приняты, поверх висит ConsentGate: две неотменяемые
  // модалки одновременно — выбор ника подождёт до согласия
  const mustChooseNickname =
    Boolean(token) &&
    me.data !== undefined &&
    me.data.consentAccepted &&
    !me.data.nicknameConfirmed

  // Телефон храним десятью цифрами без кода страны — ровно то, что даёт маска
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'phone' | 'waiting' | 'code'>('phone')
  // Согласие с условиями: до выдачи токена его некуда сохранять, поэтому
  // до конца входа оно живёт здесь, а на сервер уходит сразу после
  const [isConsentChecked, setConsentChecked] = useState(false)
  // Секрет сессии: без него бэкенд не отдаст статус входа по чужому номеру
  const [sessionId, setSessionId] = useState('')
  const [sessionNote, setSessionNote] = useState('')

  const requestCode = useRequestCodeMutation()
  const verifyCode = useVerifyCodeMutation()
  const setNicknameMutation = useSetNicknameMutation()
  const acceptSession = useAcceptSession()
  const captcha = useCaptcha()

  const session = useQuery(
    authSessionQuery(toE164(phone), sessionId, step === 'waiting' && sessionId !== ''),
  )

  // Подставляем выданный автоматически ник — его видно и можно оставить как есть.
  // Один раз на пользователя: иначе очищённое поле тут же заполнялось бы снова.
  const prefilledFor = useRef<string | null>(null)
  useEffect(() => {
    if (mustChooseNickname && me.data && prefilledFor.current !== me.data.id) {
      prefilledFor.current = me.data.id
      setNickname(me.data.nickname)
    }
  }, [mustChooseNickname, me.data])

  // Ответ опроса обрабатываем один раз: эффект перезапускается на каждый рендер
  // родителя, а второй вызов acceptSession обнулял бы кеш профиля впустую
  const handledSession = useRef(false)
  useEffect(() => {
    const result = session.data
    if (!result || handledSession.current) return

    if (result.status === 'confirmed' && result.accessToken && result.user) {
      handledSession.current = true
      acceptSession({ accessToken: result.accessToken, user: result.user })
      setPhone('')
      setSessionId('')
      setStep('phone')
      // Новому пользователю ник ещё выбирать: модалка останется открытой
      // на третьем шаге, её удержит mustChooseNickname
      if (result.user.nicknameConfirmed) closeModal()
      return
    }

    // SIM-PUSH не сработал: провайдер прислал код в SMS, дальше обычный ввод
    if (result.status === 'needs-code') {
      handledSession.current = true
      setStep('code')
      return
    }

    if (result.status === 'failed') {
      handledSession.current = true
      setSessionId('')
      setStep('phone')
      setSessionNote('Вход не подтверждён. Запросите его заново.')
      return
    }

    if (result.status === 'expired') {
      handledSession.current = true
      setSessionId('')
      setStep('phone')
      setSessionNote('Время на подтверждение вышло, запросите вход заново')
    }
  }, [session.data, acceptSession, closeModal])

  if (!isModalOpen && !mustChooseNickname) return null

  // Пока показывается задание капчи, запроса ещё нет — но кнопку уже держим
  // заблокированной, иначе второй клик откроет второе задание
  const isRequesting = captcha.isRunning || requestCode.isPending
  const canRequest = !isRequesting && isPhoneComplete(phone) && isConsentChecked
  const requestLabel = captcha.isRunning
    ? 'Подтвердите, что вы не робот'
    : requestCode.isPending
      ? 'Запрашиваем…'
      : 'Войти по телефону'

  // Капча до запроса: она защищает от спама платными авторизациями, поэтому
  // задание должно быть пройдено раньше, чем бэкенд пойдёт к провайдеру
  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault()

    const captchaResult = await captcha.getToken()
    if (!captchaResult.ok) return

    requestCode.mutate(
      { phone: toE164(phone), captchaToken: captchaResult.token },
      {
        onSuccess: (started) => {
          setSessionNote('')
          setSessionId(started.sessionId)
          handledSession.current = false
          verifyCode.reset()
          setCode('')
          // Всегда ожидание: подтвердят на SIM-карте или придёт код в SMS —
          // на этом шаге ещё неизвестно, это скажет опрос статуса
          setStep('waiting')
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
          setSessionId('')
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

  /** Вернуться к вводу телефона: начатая попытка на бэкенде истечёт сама */
  const backToPhone = () => {
    setSessionId('')
    setSessionNote('')
    setStep('phone')
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

        {step === 'phone' && (
          <form onSubmit={handleRequest} className="modal__body">
            <label className="field">
              <span className="field__label">Телефон</span>
              <PhoneInput value={phone} onChange={setPhone} autoFocus required />
            </label>
            {captcha.isDisabled && (
              <p className="panel-note -error">
                Капча выключена: не задан <code>VITE_SMARTCAPTCHA_CLIENT_KEY</code>. Вход
                запрашивается без проверки.
              </p>
            )}
            <div className="captcha-slot" ref={captcha.containerRef} />
            {captcha.errorMessage && <p className="form-error">{captcha.errorMessage}</p>}
            {sessionNote && <p className="form-error">{sessionNote}</p>}
            {requestCode.error && <p className="form-error">{requestCode.error.message}</p>}
            {/* Согласие обязательно: без него аккаунт не создаётся. Ссылки
                открываются в новой вкладке, чтобы не потерять начатый вход */}
            <label className="field-check">
              <input
                type="checkbox"
                checked={isConsentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
                required
              />
              <span>
                Я принимаю{' '}
                <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer">
                  пользовательское соглашение
                </a>{' '}
                и даю согласие на{' '}
                <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
                  обработку персональных данных
                </a>
              </span>
            </label>
            <button type="submit" className="btn-primary" disabled={!canRequest}>
              {requestLabel}
            </button>
          </form>
        )}

        {step === 'waiting' && (
          <div className="modal__body">
            <p className="panel-note">
              Подтвердите вход на телефоне {formatPhone(phone)}: запрос придёт на SIM-карту.
              Как только подтвердите, окно закроется само. Если подтверждение не дойдёт,
              пришлём код в SMS и попросим его ввести.
            </p>
            <p className="panel-note">Ждём подтверждения…</p>
            {session.error && <p className="form-error">{session.error.message}</p>}
            <button type="button" className="btn-link" onClick={backToPhone}>
              Изменить телефон
            </button>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerify} className="modal__body">
            <p className="panel-note">Отправили код в SMS на {formatPhone(phone)}.</p>
            <label className="field">
              <span className="field__label">Код из SMS</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="1234"
                inputMode="numeric"
                pattern="\d{4,8}"
                autoFocus
                required
              />
            </label>
            {verifyCode.error && <p className="form-error">{verifyCode.error.message}</p>}
            <button type="submit" className="btn-primary" disabled={verifyCode.isPending}>
              {verifyCode.isPending ? 'Проверяем…' : 'Войти'}
            </button>
            <button type="button" className="btn-link" onClick={backToPhone}>
              Изменить телефон
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
