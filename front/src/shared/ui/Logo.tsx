import { Link } from 'react-router-dom'

/** Пропорции файла в public: подставлены в атрибуты, чтобы шапка не дёргалась,
 *  пока картинка грузится. Итоговый размер задаёт CSS по высоте */
const LOGO_WIDTH = 160
const LOGO_HEIGHT = 28

/**
 * Логотип-ссылка на главную. Картинка лежит в public, а не импортируется
 * модулем: ту же самую подставляет серверный рендер страниц каталога
 * (см. renderPage в back/src/seo/page-view.ts), а он о сборке фронта не знает.
 */
export function Logo({ className }: { className: string }) {
  return (
    <Link className={className} to="/" aria-label="Квартирник — на главную">
      <img src="/logo-flatnik.svg" alt="Квартирник" width={LOGO_WIDTH} height={LOGO_HEIGHT} />
    </Link>
  )
}
