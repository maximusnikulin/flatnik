import { Controller, Get, Header, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { CatalogService } from '../catalog/catalog.service'
import { escapeHtml } from './html.util'
import { renderList, renderPage } from './page-view'
import { RenderService } from './render.service'
import { reviewsWord } from './words'

/**
 * Страницы для поисковиков и первого кадра у человека.
 *
 * Живёт под /api, как и всё остальное на бэкенде: гейтвей переписывает сюда
 * публичные пути. Так корневой маршрут вроде `:citySlug` не начинает спорить с
 * `/api` и не протекает в openapi.json.
 */
@ApiExcludeController()
@Controller('seo/page')
export class SeoController {
  constructor(
    private readonly renderService: RenderService,
    private readonly catalogService: CatalogService,
  ) {}

  /** Главная: карта плюс список городов, чтобы роботу было куда идти дальше */
  @Get()
  // Данные обязаны быть свежими: страница собирается из отзывов, а они
  // появляются и скрываются после модерации
  @Header('Cache-Control', 'no-cache')
  async home(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.type('html')

    const cities = await this.catalogService.listCities()
    const reviewCount = cities.reduce((sum, city) => sum + city.reviewCount, 0)

    const body = renderPage(
      [{ href: '/', title: 'Главная' }],
      `<h1>Отзывы жильцов о съёмных квартирах</h1>
<p class="page__summary">${escapeHtml(
        `${reviewCount} ${reviewsWord(reviewCount)} о съёмных квартирах: что рассказывают о доме, подъезде и хозяевах те, кто там жил.`,
      )}</p>
${cities.length > 0 ? '<h2>Города с отзывами</h2>' : ''}
${renderList(
  cities.map((city) => ({
    href: `/${city.citySlug}`,
    title: city.cityName,
    meta: `${city.reviewCount} ${reviewsWord(city.reviewCount)}`,
  })),
)}`,
    )

    return this.renderService.render(
      {
        title: 'flatnik — отзывы жильцов о съёмных квартирах',
        description:
          'Карта отзывов о съёмных квартирах в Москве и Санкт-Петербурге: дом, подъезд, квартира и опыт бывших жильцов.',
        canonicalPath: '/',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'flatnik',
            url: this.renderService.absoluteUrl('/'),
          },
        ],
      },
      body,
    )
  }
}
