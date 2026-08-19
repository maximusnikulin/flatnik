import { COOKIE_CONSENT_URL } from '../../../shared/lib/contacts'
import { useCookieConsent, useIsCookieBannerOpen } from '../model/cookie-consent.store'

/**
 * Баннер о cookie — первое, что видит посетитель, ещё до входа.
 *
 * Отказ не закрывает сайт. Технические cookie согласия не требуют, а
 * перекрывать доступ ради аналитики — и лишний повод для претензий, и
 * потеря трафика из поиска: отказ выключает Метрику, остальное работает.
 *
 * Кнопки одного размера и формы; «Принять всё» выделена основным цветом.
 * «Отклонить» при этом остаётся полноценной кнопкой, а не текстовой ссылкой:
 * отказ должен быть таким же доступным действием, как согласие.
 */
export function CookieBanner() {
  const isOpen = useIsCookieBannerOpen()
  const decide = useCookieConsent((s) => s.decide)

  if (!isOpen) return null

  return (
    <section className="cookie-banner" aria-label="Файлы cookie">
      <div className="cookie-banner__text">
        <h2 className="cookie-banner__title">Мы используем файлы cookie</h2>
        <p>
          Технические — для работы сайта. Аналитические — только с вашего согласия.{' '}
          <a href={COOKIE_CONSENT_URL} target="_blank" rel="noopener noreferrer">
            Подробнее
          </a>
        </p>
      </div>
      <div className="cookie-banner__actions">
        <button
          type="button"
          className="btn-cookie -primary"
          onClick={() => decide('accepted')}
        >
          Принять всё
        </button>
        <button type="button" className="btn-cookie" onClick={() => decide('declined')}>
          Отклонить
        </button>
      </div>
    </section>
  )
}
