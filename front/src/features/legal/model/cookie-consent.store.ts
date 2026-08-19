import { create } from 'zustand'

/**
 * Выбор посетителя по аналитическим cookie.
 *
 * Решение здесь ровно одно — ставить Метрику или нет: технические cookie
 * нужны для работы сайта и согласия не требуют, поэтому и переключателя по
 * ним быть не может.
 *
 * Хранится в localStorage, а не на сервере: баннер показывается до входа,
 * когда аккаунта ещё нет и привязать решение не к чему.
 */

const STORAGE_KEY = 'flatnik:cookie-consent'

export type CookieChoice = 'accepted' | 'declined'

function readStored(): CookieChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'accepted' || raw === 'declined' ? raw : null
  } catch {
    // Приватный режим без localStorage: спросим заново на следующей загрузке.
    // Отсутствие ответа трактуем как «не согласился» — молчание согласием не является
    return null
  }
}

function writeStored(choice: CookieChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Решение проживёт до перезагрузки: повторный вопрос лучше, чем поломка
  }
}

interface CookieConsentState {
  choice: CookieChoice | null
  /** Баннер вызвали заново из подвала: решение уже есть, но его меняют */
  isReopened: boolean
  decide: (choice: CookieChoice) => void
  reopen: () => void
}

export const useCookieConsent = create<CookieConsentState>((set) => ({
  choice: readStored(),
  isReopened: false,
  decide: (choice) => {
    writeStored(choice)
    set({ choice, isReopened: false })
  },
  reopen: () => set({ isReopened: true }),
}))

/** Показывать ли баннер: до первого решения и когда его меняют из подвала */
export function useIsCookieBannerOpen(): boolean {
  return useCookieConsent((s) => s.choice === null || s.isReopened)
}

/**
 * Показывать ли ссылку на настройки cookie. Принявшему всё менять нечего,
 * поэтому у него ссылки нет; отказавшийся сможет через неё передумать.
 */
export function useIsCookieSettingsShown(): boolean {
  return useCookieConsent((s) => s.choice !== 'accepted')
}

/** Разрешена ли аналитика: Метрика ставится только по явному согласию */
export function useIsAnalyticsAllowed(): boolean {
  return useCookieConsent((s) => s.choice === 'accepted')
}
