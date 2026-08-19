import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../../shared/api/fetcher'
import { useCaptcha } from '../../../shared/lib/use-captcha'
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../../../shared/lib/contacts'
import { isEmailComplete, normalizeEmail } from '../../../shared/lib/login'
import { useAuthStore } from '../model/auth.store'
import {
  meQuery,
  useRequestCodeMutation,
  useSetNicknameMutation,
  useVerifyCodeMutation,
} from '../api/auth.api'

/**
 * Вход по почте: адрес → код из письма → никнейм.
 *
 * Вход по телефону убран из интерфейса, хотя бэкенд его по-прежнему умеет:
 * мобильная авторизация приходила на SIM-карту, и с ней второй шаг начинался
 * с ожидания и опроса статуса. Почтовому коду ждать нечего — письмо уходит
 * прямо на запросе, — поэтому ни ожидания, ни опроса здесь больше нет.
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
  const mustChooseNickname =
    Boolean(token) && me.data !== undefined && !me.data.nicknameConfirmed

  const [login, setLogin] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'login' | 'code'>('login')
  const [sessionNote, setSessionNote] = useState('')

  const loginValue = normalizeEmail(login)

  /** Полный сброс ввода: и поле, и код, и шаг */
  const resetLogin = () => {
    setLogin('')
    setCode('')
    setStep('login')
  }

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

  // Номер попытки входа. Закрытие формы обесценивает начатый запрос: ответ на
  // него может прийти минутой позже, и его колбэки не должны переставлять шаг
  // у формы, которую человек уже сбросил и открыл заново
  const attempt = useRef(0)

  if (!isModalOpen && !mustChooseNickname) return null

  // Пока показывается задание капчи, запроса ещё нет — но кнопку уже держим
  // заблокированной, иначе второй клик откроет второе задание
  const isRequesting = captcha.isRunning || requestCode.isPending
  const canRequest = !isRequesting && isEmailComplete(login)
  const requestLabel = captcha.isRunning
    ? 'Подтвердите, что вы не робот'
    : requestCode.isPending
      ? 'Запрашиваем…'
      : 'Получить код'

  // Капча до запроса: она защищает от спама платными авторизациями, поэтому
  // задание должно быть пройдено раньше, чем бэкенд пойдёт к провайдеру
  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault()

    const startedAttempt = attempt.current
    const captchaResult = await captcha.getToken()
    if (!captchaResult.ok) return

    requestCode.mutate(
      { login: loginValue, captchaToken: captchaResult.token },
      {
        onSuccess: () => {
          if (attempt.current !== startedAttempt) return
          setSessionNote('')
          verifyCode.reset()
          setCode('')
          // Письмо ушло ещё на запросе, ждать нечего — сразу поле для кода
          setStep('code')
        },
        onError: (error) => {
          if (attempt.current !== startedAttempt) return
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
    setSessionNote('')
    setStep('login')
  }

  /**
   * Закрытие сбрасывает форму целиком.
   *
   * Компонент при закрытии не размонтируется — модалка живёт в Layout и просто
   * перестаёт рендериться, — поэтому состояние переживает закрытие. Долгий
   * запрос кода или показанное задание капчи иначе встречали бы человека
   * заблокированной кнопкой при следующем открытии.
   */
  const closeAndReset = () => {
    attempt.current += 1
    closeModal()
    resetLogin()
    setSessionNote('')
    captcha.reset()
    requestCode.reset()
    verifyCode.reset()
  }

  // Закрыть можно всё, кроме обязательного выбора ника
  const dismiss = mustChooseNickname ? undefined : closeAndReset

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
          <h2>Вход в Квартирник</h2>
          <button type="button" className="modal__close" onClick={dismiss} aria-label="Закрыть">
            ✕
          </button>
        </header>

        {step === 'login' && (
          <form onSubmit={handleRequest} className="modal__body">
            <label className="field">
              <span className="field__label">Email</span>
              <input
                type="email"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="you@example.com"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
              />
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
            <button type="submit" className="btn-primary" disabled={!canRequest}>
              {requestLabel}
            </button>
            {/* Согласие даётся самим действием, а не галочкой, поэтому текст
                стоит вплотную к кнопке и называет её словами. Документы —
                двумя отдельными ссылками: это разные документы, и открываются
                они в новой вкладке, чтобы не потерять введённый логин */}
            <p className="panel-note">
              Нажимая «Получить код», вы принимаете{' '}
              <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer">
                Пользовательское соглашение
              </a>{' '}
              и подтверждаете, что ознакомлены с{' '}
              <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
                Политикой обработки персональных данных
              </a>
              .
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerify} className="modal__body">
            <p className="panel-note">Отправили код на {loginValue}.</p>
            <label className="field">
              <span className="field__label">Код из письма</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
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
              Изменить почту
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
