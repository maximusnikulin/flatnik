import {
  PRIVACY_POLICY_URL,
  USER_AGREEMENT_URL,
  mailtoUrl,
} from '../../../shared/lib/contacts'
import { SupportButton } from './SupportButton'

/**
 * Те же ссылки, что и в подвале, но для карты: она занимает весь экран и
 * обычный подвал там негде показать. Живут последним элементом боковой
 * панели — с главной страницы политика тоже должна быть доступна.
 */
export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Документы и контакты">
      <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer">
        Соглашение
      </a>
      <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
        Персональные данные
      </a>
      <a href={mailtoUrl('Обращение через сайт Квартирник')}>Связаться</a>
      <SupportButton />
    </nav>
  )
}
