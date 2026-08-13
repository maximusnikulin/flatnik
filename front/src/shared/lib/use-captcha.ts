import { useCallback, useEffect, useRef, useState } from 'react'
import { CaptchaAbortError, getCaptchaToken } from './smart-captcha'

/** Результат попытки: `token` пуст, когда капча выключена — это не ошибка */
export type CaptchaResult = { ok: true; token: string | undefined } | { ok: false }

const FAILED_MESSAGE = 'Не удалось пройти проверку капчи, попробуйте ещё раз.'
const NO_SLOT_MESSAGE = 'Не удалось показать капчу: обновите страницу.'

/**
 * Капча перед отправкой формы: по клику показывает задание в слоте `containerRef`
 * и отдаёт одноразовый токен для бэкенда, когда задание пройдено.
 *
 * Без `VITE_SMARTCAPTCHA_CLIENT_KEY` возвращает `{ ok: true, token: undefined }` и
 * поднимает `isDisabled` — форма продолжает работать (бэкенд с пустым
 * `SMARTCAPTCHA_SERVER_KEY` проверку пропускает), но выключенную капчу видно на
 * экране, а не только в логе. Если ключ задан только на бэкенде, тот ответит 400:
 * ключи включаются парой.
 */
export function useCaptcha() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [isRunning, setRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const sitekey = import.meta.env.VITE_SMARTCAPTCHA_CLIENT_KEY

  // Задание ждёт человека неограниченно долго: закрыли форму — снимаем виджет,
  // иначе он остался бы жив вместе с висящим промисом
  useEffect(() => () => abortRef.current?.abort(), [])

  const getToken = useCallback(async (): Promise<CaptchaResult> => {
    if (!sitekey) return { ok: true, token: undefined }

    const container = containerRef.current
    if (!container) {
      setErrorMessage(NO_SLOT_MESSAGE)
      return { ok: false }
    }

    const abort = new AbortController()
    abortRef.current = abort
    setErrorMessage(null)
    setRunning(true)
    try {
      return { ok: true, token: await getCaptchaToken(sitekey, container, abort.signal) }
    } catch (error) {
      // Отмена — это закрытая форма, показывать в ней уже нечего. В остальном
      // причину не различаем: от пользователя в любом случае требуется одно —
      // попробовать ещё раз
      if (!(error instanceof CaptchaAbortError)) {
        setErrorMessage(FAILED_MESSAGE)
      }
      return { ok: false }
    } finally {
      abortRef.current = null
      setRunning(false)
    }
  }, [sitekey])

  return {
    /** Слот в форме, куда рендерится задание капчи */
    containerRef,
    /** Задание на экране и ждёт человека — кнопку отправки держим заблокированной */
    isRunning,
    /** Клиентский ключ не задан: капчи не будет, и это стоит показать явно */
    isDisabled: !sitekey,
    /** Текст ошибки для `.form-error`; null, пока сбоя не было */
    errorMessage,
    getToken,
  }
}
