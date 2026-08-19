import { useSyncExternalStore } from 'react'

/**
 * Единственный брейкпоинт адаптива в проекте — см. `@media (max-width: 640px)`
 * в front/src/index.css. Меняете там — меняйте и здесь.
 */
const QUERY = '(max-width: 640px)'

// Синглтон на весь модуль: тем же приёмом, что и статус карт в
// features/map/lib/ymaps.ts — matchMedia создаётся один раз, слушатели
// подписываются на него, а не плодят каждый свой MediaQueryList.
const mediaQuery = typeof window !== 'undefined' ? window.matchMedia(QUERY) : null

function subscribe(callback: () => void): () => void {
  if (!mediaQuery) return () => {}
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return mediaQuery?.matches ?? false
}

/** Мобильная раскладка: карты нет, панели идут в потоке, а не поверх карты */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
