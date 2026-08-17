import { mailtoUrl } from '../../../shared/lib/contacts'

/**
 * Кнопка «Поддержать» — ведёт на форму доната.
 *
 * Визуально повторяет стиль логотипа: белый текст на фиолетовом фоне,
 * закруглённая форма, знак рубля слева от текста.
 */
export function SupportButton({ className }: { className?: string }) {
  return (
    <a
      href={mailtoUrl('Поддержка проекта Квартирник', 'Здравствуйте! Хочу поддержать проект Квартирник.')}
      className={className ?? 'support-button'}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Поддержать проект"
    >
      <svg
        className="support-button__icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
          fill="currentColor"
        />
        <path
          d="M11 7h2v3h3v2h-3v3h-2v-3H8v-2h3V7z"
          fill="currentColor"
        />
      </svg>
      <span className="support-button__text">ПОДДЕРЖАТЬ</span>
    </a>
  )
}
