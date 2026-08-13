/**
 * Видимая Yandex SmartCaptcha: задание рендерится в контейнер внутри формы и живёт
 * от нажатия кнопки до результата. Скрипт грузится один раз на уровне модуля.
 *
 * Невидимый режим не используется намеренно: он не показывает задание доверенному
 * пользователю, поэтому работающая капча выглядела ровно как выключенная.
 */
const SCRIPT_SRC = 'https://smartcaptcha.yandexcloud.net/captcha.js'

let scriptPromise: Promise<SmartCaptcha> | null = null

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

/** Признак того, что попытку сняли извне (закрыли форму), а не что капча сломалась */
export class CaptchaAbortError extends Error {
  constructor() {
    super('проверка капчи отменена')
    this.name = 'CaptchaAbortError'
  }
}

/**
 * Показывает задание в `container` и возвращает одноразовый токен для бэкенда.
 * Бросает ошибку, если капча не загрузилась, сломалась или токен истёк.
 *
 * Виджет создаётся на каждый вызов и снимается по завершении: токен одноразовый,
 * переиспользовать нечего, а две формы (вход и отзыв) не делят один виджет.
 *
 * `signal` нужен, потому что задание ждёт человека неограниченно долго: без отмены
 * промис остался бы висеть после закрытия формы вместе с живым виджетом.
 */
export async function getCaptchaToken(
  sitekey: string,
  container: HTMLElement,
  signal?: AbortSignal,
): Promise<string> {
  const captcha = await loadCaptcha()
  if (signal?.aborted) throw new CaptchaAbortError()
  const id = captcha.render(container, { sitekey, hl: 'ru' })

  return new Promise<string>((resolve, reject) => {
    const unsubscribers: Array<() => void> = []
    // Отмена и события виджета могут прийти в любом порядке, а destroy повторно
    // вызывать нельзя — поэтому первый результат закрывает попытку
    let isSettled = false
    const finish = (action: () => void) => {
      if (isSettled) return
      isSettled = true
      for (const unsubscribe of unsubscribers) unsubscribe()
      captcha.destroy(id)
      // Слот скрыт правилом `:empty`, поэтому в нём не должно остаться даже пустых
      // узлов от снятого виджета. React в эти дети не заглядывает — они не его.
      container.replaceChildren()
      action()
    }

    signal?.addEventListener('abort', () => finish(() => reject(new CaptchaAbortError())), {
      once: true,
    })

    unsubscribers.push(captcha.subscribe(id, 'success', (token) => finish(() => resolve(token))))
    unsubscribers.push(
      captcha.subscribe(id, 'token-expired', () =>
        finish(() => reject(new Error('время на проверку истекло'))),
      ),
    )
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
    // На 'challenge-hidden' не подписываемся: закрытое задание видимого виджета —
    // не конец попытки, пользователь решает его в том же виджете.
  })
}
