/**
 * Кнопка «Поддержать» — ведёт на форму доната.
 *
 * Визуально повторяет стиль логотипа: белый текст на фиолетовом фоне,
 * закруглённая форма, знак рубля слева от текста.
 */
export function SupportButton({ className }: { className?: string }) {
  return (
    <a
      href="https://pay.cloudtips.ru/p/a59aed56"
      className={className ?? "support-button"}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Поддержать проект"
    >
      <span className="support-button__ruble">₽</span>
      <span className="support-button__text">ПОДДЕРЖАТЬ</span>
    </a>
  );
}
