/** Минимальная типизация виджета Yandex SmartCaptcha (captcha.js) */
interface SmartCaptchaSubscribeEventMap {
  success: (token: string) => void
  'javascript-error': () => void
  'network-error': () => void
  'challenge-hidden': () => void
}

interface SmartCaptcha {
  render(
    container: HTMLElement,
    params: { sitekey: string; invisible?: boolean; hideShield?: boolean },
  ): number
  execute(widgetId: number): void
  reset(widgetId: number): void
  subscribe<E extends keyof SmartCaptchaSubscribeEventMap>(
    widgetId: number,
    event: E,
    callback: SmartCaptchaSubscribeEventMap[E],
  ): () => void
}

interface Window {
  smartCaptcha?: SmartCaptcha
}
