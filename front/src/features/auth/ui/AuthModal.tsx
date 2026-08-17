import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../../shared/api/fetcher'
import { useCaptcha } from '../../../shared/lib/use-captcha'
import { formatPhone, isPhoneComplete, toE164 } from '../../../shared/lib/phone'
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../../../shared/lib/contacts'
import { detectLoginKind, isLoginComplete, toLogin } from '../../../shared/lib/login'
import { LoginInput } from '../../../shared/ui/LoginInput'
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

  // Ввод храним дважды: как он выглядит в поле и как десять цифр телефона.
  // Второе нужно только телефонной ветке — из маски цифры иначе не достать
  const [login, setLogin] = useState('')
  const [digits, setDigits] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'login' | 'waiting' | 'code'>('login')
  const [isConsentChecked, setConsentChecked] = useState(false)

  // Секрет сессии: без него бэкенд не отдаст статус чужого входа
  const [sessionId, setSessionId] = useState('')
  const [sessionNote, setSessionNote] = useState('')

  const kind = detectLoginKind(login)
  const loginValue = toLogin(login, digits)

  /** Полный сброс ввода: и поле, и цифры телефона, и шаг */
  const resetLogin = () => {
    setLogin('')
    setDigits('')
    setCode('')
    setSessionId('')
    setStep('login')
  }

  const requestCode = useRequestCodeMutation()
  const verifyCode = useVerifyCodeMutation()
  const setNicknameMutation = useSetNicknameMutation()
  const acceptSession = useAcceptSession()
  const captcha = useCaptcha()

  const session = useQuery(
    authSessionQuery(loginValue, sessionId, step === 'waiting' && sessionId !== ''),
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
      resetLogin()
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
      setStep('login')
      setSessionNote('Вход не подтверждён. Запросите его заново.')
      return
    }

    if (result.status === 'expired') {
      handledSession.current = true
      setSessionId('')
      setStep('login')
      setSessionNote('Время на подтверждение вышло, запросите вход заново')
    }
  }, [session.data, acceptSession, closeModal])

  if (!isModalOpen && !mustChooseNickname) return null

  // Пока показывается задание капчи, запроса ещё нет — но кнопку уже держим
  // заблокированной, иначе второй клик откроет второе задание
  const isRequesting = captcha.isRunning || requestCode.isPending
  const canRequest = !isRequesting && isLoginComplete(login, digits) && isConsentChecked
  const requestLabel = captcha.isRunning
    ? 'Подтвердите, что вы не робот'
    : requestCode.isPending
      ? 'Запрашиваем…'
      : 'Войти'

  // Капча до запроса: она защищает от спама платными авторизациями, поэтому
  // задание должно быть пройдено раньше, чем бэкенд пойдёт к провайдеру
  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault()

    const captchaResult = await captcha.getToken()
    if (!captchaResult.ok) return

    requestCode.mutate(
      { login: loginValue, captchaToken: captchaResult.token },
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
        onError: (error) => {
          // 429 — не отказ, а «код уже отправлен»: попытка живёт пять минут,
          // а пауза между запросами минуту. Заявка заведена, код у человека
          // на руках, и verify-code примет его по тому же идентификатору —
          // остаётся показать поле ввода. Опрос статуса тут не нужен: без
          // sessionId он всё равно ответил бы «истекло»
          if (error instanceof ApiError && error.status === 429) {
            setSessionNote('')
            verifyCode.reset()
            setCode('')
            setStep('code')
          }
        },
      },
    )
  }

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault()
    verifyCode.mutate(
      { login: loginValue, code },
      {
        onSuccess: (data) => {
          resetLogin()
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

  /** Вернуться к вводу: начатая попытка на бэкенде истечёт сама */
  const backToLogin = () => {
    setSessionId('')
    setSessionNote('')
    setStep('login')
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
          <h2>Вход</h2>
          <button type="button" className="modal__close" onClick={dismiss} aria-label="Закрыть">
            ✕
          </button>
        </header>

        {step === 'login' && (
          <form onSubmit={handleRequest} className="modal__body">
            <label className="field">
              <span className="field__label">Телефон или email</span>
              <LoginInput
                value={login}
                onChange={(next, nextDigits) => {
                  setLogin(next)
                  setDigits(nextDigits)
                }}
                autoFocus
                required
              />
            </label>
            <p className="panel-note">
              Вход по телефону сейчас работает нестабильно — если код не приходит,
              войдите по почте.
            </p>
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
              Подтвердите вход на телефоне {formatPhone(digits)}: запрос придёт на SIM-карту.
              Как только подтвердите, окно закроется само. Если подтверждение не дойдёт,
              пришлём код в SMS и попросим его ввести.
            </p>
            <p className="panel-note">Ждём подтверждения…</p>
            {session.error && <p className="form-error">{session.error.message}</p>}
            <button type="button" className="btn-link" onClick={backToLogin}>
              Изменить телефон
            </button>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerify} className="modal__body">
            <p className="panel-note">
              {kind === 'email'
                ? `Отправили код на ${loginValue}.`
                : `Отправили код в SMS на ${formatPhone(digits)}.`}
            </p>
            <label className="field">
              <span className="field__label">{kind === 'email' ? 'Код из письма' : 'Код из SMS'}</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={kind === 'email' ? '123456' : '1234'}
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
            <button type="button" className="btn-link" onClick={backToLogin}>
              {kind === 'email' ? 'Изменить почту' : 'Изменить телефон'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
