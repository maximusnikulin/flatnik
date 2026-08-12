/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ Яндекс Карт JS API; пусто — вместо карты заглушка */
  readonly VITE_YANDEX_MAPS_API_KEY?: string
  /** Ключ Geocoder API (поиск адреса); пусто — берётся ключ карты */
  readonly VITE_YANDEX_SEARCH_API_KEY?: string
  /** Ключ Suggest API (подсказки адреса); пусто — берётся ключ карты */
  readonly VITE_YANDEX_SUGGEST_API_KEY?: string
  /** Клиентский ключ SmartCaptcha; пусто — отправка отзыва без капчи */
  readonly VITE_SMARTCAPTCHA_CLIENT_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
