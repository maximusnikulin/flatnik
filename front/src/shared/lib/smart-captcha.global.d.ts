/** Минимальная типизация виджета Yandex SmartCaptcha (captcha.js) */
interface SmartCaptchaSubscribeEventMap {
  success: (token: string) => void
  'token-expired': () => void
  'javascript-error': () => void
  'network-error': () => void
  'challenge-hidden': () => void
}

interface SmartCaptcha {
  render(
    container: HTMLElement,
    params: {
      sitekey: string
      /** Язык интерфейса задания */
      hl?: string
      invisible?: boolean
      hideShield?: boolean
      /** Отладочный режим: задание показывается всегда и всегда решается */
      test?: boolean
    },
  ): number
  execute(widgetId: number): void
  reset(widgetId: number): void
  /** Снимает виджет: контейнер очищается, идентификатор становится недействительным */
  destroy(widgetId: number): void
  subscribe<E extends keyof SmartCaptchaSubscribeEventMap>(
    widgetId: number,
    event: E,
    callback: SmartCaptchaSubscribeEventMap[E],
  ): () => void
}

interface Window {
  smartCaptcha?: SmartCaptcha
}
