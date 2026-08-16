/**
 * Яндекс.Метрика. Подключается динамически, как и карты: без счётчика
 * приложение остаётся полностью рабочим, а тег в index.html пришлось бы
 * держать даже там, где счётчика нет.
 *
 * Это не только аналитика: поведение посетителей из поиска Яндекс учитывает
 * при ранжировании, и данные Метрики — часть той же задачи продвижения.
 */

const counterId = import.meta.env.VITE_YANDEX_METRICA_ID

declare global {
  interface Window {
    ym?: ((id: number, action: string, ...args: unknown[]) => void) & { a?: unknown[]; l?: number }
  }
}

let started = false

/** Ставит счётчик; повторные вызовы игнорируются */
export function initMetrica(): void {
  if (!counterId || started || typeof window === 'undefined') {
    return
  }
  started = true

  // Очередь до загрузки скрипта — тот же приём, что в сниппете Метрики:
  // хиты, случившиеся раньше загрузки, не теряются
  window.ym =
    window.ym ||
    function queued(...args: unknown[]) {
      ;(window.ym!.a = window.ym!.a || []).push(args)
    }
  window.ym.l = Date.now()

  const script = document.createElement('script')
  script.src = 'https://mc.yandex.ru/metrika/tag.js'
  script.async = true
  document.head.append(script)

  window.ym(Number(counterId), 'init', {
    // Все просмотры, включая первый, отправляет useMetricaPageview: переходы
    // внутри приложения адрес не перезагружают, и Метрика насчитала бы один
    // просмотр за сессию. Хит при инициализации здесь запрещён намеренно —
    // иначе первый просмотр ушёл бы дважды.
    defer: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  })
}

// Последний отправленный адрес: единственный источник правды о том, что уже
// посчитано. Раньше первый просмотр пропускался как «его считает init», но при
// defer Метрика не считает ничего — и он терялся целиком.
let lastTrackedUrl: string | null = null

/** Просмотр страницы; повторный хит по тому же адресу подряд не отправляется */
export function trackPageview(url: string): void {
  if (!counterId || !window.ym || url === lastTrackedUrl) {
    return
  }
  lastTrackedUrl = url
  window.ym(Number(counterId), 'hit', url)
}

/** Задан ли счётчик: без него хуки не делают ничего */
export const isMetricaEnabled = Boolean(counterId)
