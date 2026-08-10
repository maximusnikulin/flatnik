import React, { useSyncExternalStore } from 'react'
import ReactDOM from 'react-dom'
import type { SearchOptions } from '@yandex/ymaps3-types'

/**
 * Загрузка Яндекс Карт JS API 3.0. Скрипт подключается динамически, а не
 * тегом в index.html: без ключа приложение остаётся живым (панели и формы
 * работают), ошибки загрузки видны явно, а singleton-promise идемпотентен
 * под двойными эффектами StrictMode.
 */

async function initYmaps(apiKey: string) {
  await loadScript(`https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`)
  await ymaps3.ready
  // reactify — не npm-пакет: официальный биндинг подгружается рантаймом карт
  const { reactify } = await ymaps3.import('@yandex/ymaps3-reactify')
  return reactify.bindTo(React, ReactDOM).module(ymaps3)
}

/** Реактифицированные компоненты карты (YMap, слои, YMapMarker, ...) */
export type YmapsComponents = Awaited<ReturnType<typeof initYmaps>>

export type YmapsState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; components: YmapsComponents }

const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY

let state: YmapsState = apiKey ? { status: 'loading' } : { status: 'disabled' }
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function startLoading(): void {
  if (!apiKey || loadPromise) return
  loadPromise = initYmaps(apiKey).then(
    (components) => {
      state = { status: 'ready', components }
      notify()
    },
    (error: unknown) => {
      state = { status: 'error', message: error instanceof Error ? error.message : String(error) }
      notify()
    },
  )
}

function subscribe(listener: () => void): () => void {
  startLoading()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): YmapsState {
  return state
}

/** Текущее состояние загрузки карт; инициирует загрузку при первом использовании */
export function useYmaps(): YmapsState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('не удалось загрузить скрипт Яндекс Карт'))
    document.head.append(script)
  })
}

export interface FoundAddress {
  address: string
  lat: number
  lon: number
}

/**
 * Геокодирует строку или uri саджеста; берёт первый результат с координатами.
 * Вызывать только при status === 'ready'.
 */
export async function findAddress(query: Pick<SearchOptions, 'text' | 'uri'>): Promise<FoundAddress | null> {
  const results = await ymaps3.search({ ...query, limit: 1 })
  const feature = results.find((item) => item.geometry?.coordinates)
  if (!feature?.geometry) return null
  const [lon, lat] = feature.geometry.coordinates
  return { address: formatAddress(feature.properties), lat, lon }
}

/** «Верхняя Красносельская, 10» + «Москва, Россия» → «Москва, Верхняя Красносельская, 10» */
function formatAddress(props: { name: string; description: string }): string {
  const region = props.description.replace(/, Россия$/u, '').trim()
  return region ? `${region}, ${props.name}` : props.name
}
