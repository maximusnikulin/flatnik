/**
 * Невидимая Yandex SmartCaptcha: виджет живёт в скрытом контейнере на уровне
 * модуля (вне React-дерева), скрипт и рендер выполняются один раз.
 */
const SCRIPT_SRC = 'https://smartcaptcha.yandexcloud.net/captcha.js'

let scriptPromise: Promise<SmartCaptcha> | null = null
let widgetId: number | null = null

function loadCaptcha(): Promise<SmartCaptcha> {
  if (window.smartCaptcha) return Promise.resolve(window.smartCaptcha)
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.onload = () => {
      if (window.smartCaptcha) {
        resolve(window.smartCaptcha)
      } else {
        reject(new Error('скрипт капчи загрузился, но window.smartCaptcha не появился'))
      }
    }
    script.onerror = () => reject(new Error('не удалось загрузить скрипт SmartCaptcha'))
    document.head.append(script)
  })
  return scriptPromise
}

/**
 * Показывает невидимую капчу и возвращает одноразовый токен для бэкенда.
 * Бросает ошибку, если пользователь закрыл задание или произошёл сбой.
 */
export async function getCaptchaToken(sitekey: string): Promise<string> {
  const captcha = await loadCaptcha()

  if (widgetId === null) {
    const container = document.createElement('div')
    container.className = 'smart-captcha-host'
    document.body.append(container)
    widgetId = captcha.render(container, { sitekey, invisible: true, hideShield: false })
  }
  const id = widgetId

  return new Promise<string>((resolve, reject) => {
    const unsubscribers: Array<() => void> = []
    const finish = (action: () => void) => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      captcha.reset(id)
      action()
    }

    unsubscribers.push(captcha.subscribe(id, 'success', (token) => finish(() => resolve(token))))
    unsubscribers.push(
      captcha.subscribe(id, 'javascript-error', () =>
        finish(() => reject(new Error('капча завершилась ошибкой'))),
      ),
    )
    unsubscribers.push(
      captcha.subscribe(id, 'network-error', () =>
        finish(() => reject(new Error('нет сети для проверки капчи'))),
      ),
    )
    unsubscribers.push(
      captcha.subscribe(id, 'challenge-hidden', () =>
        // Событие приходит и после success — но там подписки уже сняты
        finish(() => reject(new Error('проверка отменена'))),
      ),
    )

    captcha.execute(id)
  })
}
