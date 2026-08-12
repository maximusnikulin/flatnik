/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ Яндекс Карт: JS API, Geocoder и Suggest; пусто — вместо карты заглушка */
  readonly VITE_YANDEX_MAPS_API_KEY?: string
  /** Клиентский ключ SmartCaptcha; пусто — отправка отзыва без капчи */
  readonly VITE_SMARTCAPTCHA_CLIENT_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
