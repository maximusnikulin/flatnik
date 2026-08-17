import {
  PRIVACY_POLICY_URL,
  USER_AGREEMENT_URL,
  mailtoUrl,
} from '../../../shared/lib/contacts'
import { SupportButton } from './SupportButton'

/**
 * Подвал страниц каталога.
 *
 * Ту же разметку отдаёт сервер — `renderFooter` в `back/src/seo/page-view.ts`.
 * Расходиться им нельзя: подвал попадает в первый кадр и в индекс, а клиент
 * заменяет серверный рендер своим.
 *
 * На карте подвала нет: там страница — полноэкранный слой без прокрутки,
 * и те же ссылки живут в `LegalLinks` внизу боковой панели.
 */
export function Footer() {
  return (
    <footer className="page__footer">
      <p className="page__footer-note">
        Отзывы отражают личное мнение их авторов и не являются утверждениями о фактах.
        Сервис не проверяет их достоверность. Если отзыв нарушает ваши права, напишите
        нам — мы рассмотрим обращение.
      </p>
      <nav className="page__footer-links" aria-label="Документы и контакты">
        <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer">
          Пользовательское соглашение
        </a>
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
          Политика обработки персональных данных
        </a>
        <a href={mailtoUrl('Обращение через сайт Квартирник')}>Связаться с нами</a>
        <SupportButton />
      </nav>
    </footer>
  )
}
