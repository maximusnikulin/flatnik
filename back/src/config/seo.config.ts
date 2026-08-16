import { registerAs } from '@nestjs/config'

/**
 * Серверный рендер публичных страниц.
 *
 * `baseUrl` — тот же PUBLIC_URL, что и у mobile-id: адрес сайта наружу один, и
 * заводить вторую переменную с тем же смыслом нельзя — они разъедутся. Берётся
 * он только из окружения и никогда из заголовков запроса: за edge-прокси и
 * гейтвеем в Host легко попадает внутреннее имя контейнера или http вместо
 * https, и canonical увёл бы поисковик на несуществующий адрес.
 *
 * `indexHtml` — источник шаблона страницы. В production это файл из тома,
 * который наполняет сборка фронта; в разработке — адрес vite, потому что он
 * добавляет в HTML свой клиент и обработчик обновлений.
 */
export const seoConfig = registerAs('seo', () => ({
  baseUrl: (process.env.PUBLIC_URL ?? 'https://flatnik.ru').replace(/\/+$/, ''),
  indexHtml: process.env.SEO_INDEX_HTML ?? '/srv/static/index.html',
}))
