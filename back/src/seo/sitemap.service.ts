import { Injectable, Logger } from '@nestjs/common'
import { CatalogService } from '../catalog/catalog.service'
import { RenderService } from './render.service'

/**
 * Потолок ссылок в одном файле. Формат разрешает 50 000; берём с запасом,
 * а при упоре нужен sitemap-index — несколько файлов и оглавление к ним.
 */
const SITEMAP_LIMIT = 45000

/** Одна запись карты сайта */
interface SitemapUrl {
  loc: string
  lastmod: string
}

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name)

  constructor(
    private readonly catalogService: CatalogService,
    private readonly renderService: RenderService,
  ) {}

  /**
   * Карта сайта: главная, города, улицы и дома с подтверждёнными отзывами.
   *
   * changefreq и priority не пишем — Яндекс и Google их игнорируют, а лишние
   * теги только раздувают файл.
   */
  async build(): Promise<string> {
    const houses = await this.catalogService.listSitemapEntries()

    // Дата хаба — самая свежая среди его домов: страница улицы меняется тогда,
    // когда меняется хотя бы один дом на ней
    const cities = new Map<string, string>()
    const streets = new Map<string, string>()
    const urls: SitemapUrl[] = []

    for (const house of houses) {
      const cityPath = `/${house.citySlug}`
      const streetPath = `${cityPath}/${house.streetSlug}`
      urls.push({ loc: `${streetPath}/${house.houseSlug}`, lastmod: house.lastmod })
      cities.set(cityPath, max(cities.get(cityPath), house.lastmod))
      streets.set(streetPath, max(streets.get(streetPath), house.lastmod))
    }

    const all: SitemapUrl[] = [
      { loc: '/', lastmod: newest(houses.map((house) => house.lastmod)) },
      ...[...cities].map(([loc, lastmod]) => ({ loc, lastmod })),
      ...[...streets].map(([loc, lastmod]) => ({ loc, lastmod })),
      ...urls,
    ]

    if (all.length > SITEMAP_LIMIT) {
      this.logger.warn(
        `Ссылок ${all.length} при лимите ${SITEMAP_LIMIT} — карта сайта обрезана, пора разбивать её на части`,
      )
    }

    const body = all
      .slice(0, SITEMAP_LIMIT)
      .map(
        (url) =>
          `  <url><loc>${escapeXml(this.renderService.absoluteUrl(url.loc))}</loc><lastmod>${url.lastmod}</lastmod></url>`,
      )
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`
  }
}

function max(current: string | undefined, candidate: string): string {
  return current && current > candidate ? current : candidate
}

function newest(dates: string[]): string {
  return dates.reduce((latest, date) => (date > latest ? date : latest), new Date(0).toISOString())
}

/** В слагах спецсимволов не бывает, но карту сайта читает XML-парсер */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
