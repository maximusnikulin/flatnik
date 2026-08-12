import React, { useSyncExternalStore } from "react";
import ReactDOM from "react-dom";

/**
 * Загрузка Яндекс Карт JS API 3.0. Скрипт подключается динамически, а не
 * тегом в index.html: без ключа приложение остаётся живым (панели и формы
 * работают), ошибки загрузки видны явно, а singleton-promise идемпотентен
 * под двойными эффектами StrictMode.
 */

async function initYmaps(apiKey: string) {
  await loadScript(
    `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`,
  );
  await ymaps3.ready;

  ymaps3.getDefaultConfig().setApikeys({
    search: apiKey,
    suggest: apiKey,
  });

  // reactify — не npm-пакет: официальный биндинг подгружается рантаймом карт
  const { reactify } = await ymaps3.import("@yandex/ymaps3-reactify");
  return reactify.bindTo(React, ReactDOM).module(ymaps3);
}

/** Реактифицированные компоненты карты (YMap, слои, YMapMarker, ...) */
export type YmapsComponents = Awaited<ReturnType<typeof initYmaps>>;

export type YmapsState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; components: YmapsComponents };

const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;

let state: YmapsState = apiKey ? { status: "loading" } : { status: "disabled" };
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function startLoading(): void {
  if (!apiKey || loadPromise) return;
  loadPromise = initYmaps(apiKey).then(
    (components) => {
      state = { status: "ready", components };
      notify();
    },
    (error: unknown) => {
      state = {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
      notify();
    },
  );
}

function subscribe(listener: () => void): () => void {
  startLoading();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): YmapsState {
  return state;
}

/** Текущее состояние загрузки карт; инициирует загрузку при первом использовании */
export function useYmaps(): YmapsState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("не удалось загрузить скрипт Яндекс Карт"));
    document.head.append(script);
  });
}

export interface FoundAddress {
  address: string;
  lat: number;
  lon: number;
}

/** Результат поиска: адрес, «ничего не найдено» или отказ геокодера */
export type FindAddressResult =
  | { status: "found"; address: FoundAddress; kind?: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

/**
 * Геокодирует строку в адрес через Geocoder API Яндекса.
 * В `text` — либо адрес текстом, либо координаты "lon,lat" (обратное геокодирование).
 * Берёт первый результат с координатами.
 *
 * `uri` из саджеста здесь не принимается: Geocoder REST API его не поддерживает.
 */
export async function findAddress(
  query: { text: string },
): Promise<FindAddressResult> {
  // Тот же ключ, что у JS API: без него карта уходит в status 'disabled',
  // но findAddress экспортирован и может быть вызван раньше — отвечаем явно,
  // а не уходим в запрос с apikey=undefined
  if (!apiKey) {
    return {
      status: "error",
      message: "не задан VITE_YANDEX_MAPS_API_KEY",
    };
  }

  const url = `https://geocode-maps.yandex.ru/v1/?geocode=${encodeURIComponent(query.text)}&apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&format=json&results=1`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error: unknown) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "сервис геокодирования недоступен",
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: `ошибка геокодирования: ${response.status} ${response.statusText}`,
    };
  }

  const json = await response.json();
  const featureMember = json.response?.GeoObjectCollection?.featureMember;

  if (!featureMember || featureMember.length === 0) {
    return { status: "not-found" };
  }

  const geoObject = featureMember[0].GeoObject;
  if (!geoObject?.Point?.pos) {
    return { status: "not-found" };
  }

  const [lon, lat] = geoObject.Point.pos.split(" ").map(Number);
  const name = geoObject.name || "";
  const description = geoObject.description || "";
  const kind = geoObject.metaDataProperty?.GeocoderMetaData?.kind;

  return {
    status: "found",
    address: { address: formatAddress({ name, description }), lat, lon },
    kind,
  };
}

/**
 * Адрес по точке карты (обратное геокодирование) — для клика по зданию.
 * Порядок координат в запросе — lon,lat (Geocoder API ожидает longitude,latitude).
 */
export function findAddressByPoint(
  lon: number,
  lat: number,
): Promise<FindAddressResult> {
  return findAddress({ text: `${lon},${lat}` });
}

/** «Верхняя Красносельская, 10» + «Москва, Россия» → «Москва, Верхняя Красносельская, 10» */
function formatAddress(props: { name: string; description: string }): string {
  const region = props.description.replace(/, Россия$/u, "").trim();
  return region ? `${region}, ${props.name}` : props.name;
}
