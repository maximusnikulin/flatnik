/**
 * Черновики отзывов в localStorage: форма длинная (период, кадастровый номер
 * из выписки, текст до 500 символов), и терять её на перезагрузке обидно.
 *
 * Всё хранится одной записью со словарём по ключу квартиры: так проще убирать
 * протухшее и не нужно перебирать ключи localStorage.
 */
const STORAGE_KEY = 'flatnik:review-drafts'

/** Брошенные черновики не должны копиться в браузере вечно */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Поля черновика — ровно то, что человек набирает руками */
export interface ReviewDraft {
  apartmentNumber: string
  entrance: string
  periodFrom: string
  periodTo: string
  egrn: string
  text: string
  rating: number | null
}

type StoredDraft = ReviewDraft & { savedAt: number }

/**
 * Ключ фиксируется в момент открытия формы и дальше не меняется. Когда квартира
 * известна заранее (форму открыли из её панели) — ключ до квартиры; когда нет —
 * до дома: номер и подъезд человек в этот момент ещё печатает, и включи мы их
 * в ключ, черновик прыгал бы между ключами на каждый символ.
 */
export function draftKey(address: string, apartment?: { entrance: string; number: string }): string {
  return apartment ? `${address}|${apartment.entrance}|${apartment.number}` : address
}

/** Словарь целиком; битое или отсутствующее содержимое — пустой словарь */
function readAll(): Record<string, StoredDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Record<string, StoredDraft>
  } catch {
    // приватный режим без localStorage или мусор в записи — работаем без черновиков
    return {}
  }
}

function writeAll(drafts: Record<string, StoredDraft>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // квота или приватный режим — черновик проживёт до перезагрузки
  }
}

/** Выбрасывает протухшее; заодно чинит записи без savedAt от прошлых версий */
function withoutStale(drafts: Record<string, StoredDraft>): Record<string, StoredDraft> {
  const oldest = Date.now() - MAX_AGE_MS
  return Object.fromEntries(
    Object.entries(drafts).filter(([, draft]) => (draft?.savedAt ?? 0) > oldest),
  )
}

/** Сохранённый черновик или null, если его нет */
export function loadDraft(key: string): ReviewDraft | null {
  const drafts = withoutStale(readAll())
  const stored = drafts[key]
  if (!stored) return null
  const { savedAt: _savedAt, ...draft } = stored
  return draft
}

export function saveDraft(key: string, draft: ReviewDraft): void {
  const drafts = withoutStale(readAll())
  drafts[key] = { ...draft, savedAt: Date.now() }
  writeAll(drafts)
}

/** Отзыв отправлен — черновик больше не нужен */
export function clearDraft(key: string): void {
  const drafts = withoutStale(readAll())
  delete drafts[key]
  writeAll(drafts)
}
