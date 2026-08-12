import { useCallback, useState } from 'react'
import { getCaptchaToken } from './smart-captcha'

/** Результат попытки: `token` пуст, когда капча выключена — это не ошибка */
export type CaptchaResult = { ok: true; token: string | undefined } | { ok: false }

const FAILED_MESSAGE = 'Не удалось пройти проверку капчи, попробуйте ещё раз.'

/**
 * Невидимая капча перед отправкой формы: держит состояние показа задания
 * и отдаёт одноразовый токен для бэкенда.
 *
 * Без `VITE_SMARTCAPTCHA_CLIENT_KEY` возвращает `{ ok: true, token: undefined }` —
 * форма работает, а бэкенд с пустым `SMARTCAPTCHA_SERVER_KEY` проверку пропускает.
 * Если ключ задан только на бэкенде, тот ответит 400: ключи включаются парой.
 */
export function useCaptcha() {
  const [isRunning, setRunning] = useState(false)
  const [hasFailed, setFailed] = useState(false)

  const getToken = useCallback(async (): Promise<CaptchaResult> => {
    const sitekey = import.meta.env.VITE_SMARTCAPTCHA_CLIENT_KEY
    if (!sitekey) return { ok: true, token: undefined }

    setFailed(false)
    setRunning(true)
    try {
      return { ok: true, token: await getCaptchaToken(sitekey) }
    } catch {
      // Пользователь закрыл задание или капча сломалась — причину не различаем,
      // от него в любом случае требуется одно: попробовать ещё раз
      setFailed(true)
      return { ok: false }
    } finally {
      setRunning(false)
    }
  }, [])

  return {
    /** Задание капчи на экране — кнопку отправки держим заблокированной */
    isRunning,
    /** Текст ошибки для `.form-error`; null, пока сбоя не было */
    errorMessage: hasFailed ? FAILED_MESSAGE : null,
    getToken,
  }
}
