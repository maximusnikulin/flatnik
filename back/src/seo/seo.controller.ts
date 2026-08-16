import { Controller, Get, Header, Param, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { CatalogService } from '../catalog/catalog.service'
import { escapeHtml } from './html.util'
import { breadcrumbList, collectionPage, houseSchema } from './json-ld'
import { renderList, renderPage, renderReview } from './page-view'
import type { PageLink } from './page-view'
import { RenderService } from './render.service'
import { apartmentsWord, cityIn, formatRating, housesWord, reviewsWord, streetsWord } from './words'

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

  /** Улицы города */
  @Get(':citySlug')
  @Header('Cache-Control', 'no-cache')
  async city(
    @Param('citySlug') citySlug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    res.type('html')

    const city = await this.catalogService.findCity(citySlug, 1)
    if (!city) {
      return this.notFound(res, [{ href: '/', title: 'Главная' }], 'Город не найден')
    }

    const path = `/${citySlug}`
    const crumbs: PageLink[] = [{ href: '/', title: 'Главная' }, { href: path, title: city.cityName }]
    const items = city.streets.map((street) => ({
      href: `${path}/${street.streetSlug}`,
      title: street.streetName,
      meta: `${street.reviewCount} ${reviewsWord(street.reviewCount)}`,
    }))

    const body = renderPage(
      crumbs,
      `<h1>Отзывы о съёмных квартирах в ${escapeHtml(cityIn(city.cityName))}</h1>
<p class="page__summary">${escapeHtml(
        `${city.reviewCount} ${reviewsWord(city.reviewCount)} о ${city.houseCount} ${housesWord(city.houseCount)}`,
      )}</p>
${renderList(items)}`,
    )

    return this.renderService.render(
      {
        title: `Отзывы о съёмных квартирах в ${cityIn(city.cityName)} — flatnik`,
        description: `${city.reviewCount} ${reviewsWord(city.reviewCount)} от бывших жильцов по ${city.streetCount} ${streetsWord(city.streetCount)} города ${city.cityName}.`,
        canonicalPath: path,
        jsonLd: [
          this.crumbsSchema(crumbs),
          collectionPage({
            name: `Улицы города ${city.cityName}`,
            url: this.renderService.absoluteUrl(path),
            items: items.map((item) => ({
              name: item.title,
              url: this.renderService.absoluteUrl(item.href),
            })),
          }),
        ],
      },
      body,
    )
  }

  /** Дома улицы */
  @Get(':citySlug/:streetSlug')
  @Header('Cache-Control', 'no-cache')
  async street(
    @Param('citySlug') citySlug: string,
    @Param('streetSlug') streetSlug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    res.type('html')

    const street = await this.catalogService.findStreet(citySlug, streetSlug, 1)
    if (!street) {
      return this.notFound(
        res,
        [{ href: '/', title: 'Главная' }, { href: `/${citySlug}`, title: citySlug }],
        'Улица не найдена',
      )
    }

    const path = `/${citySlug}/${streetSlug}`
    const crumbs: PageLink[] = [
      { href: '/', title: 'Главная' },
      { href: `/${citySlug}`, title: street.cityName },
      { href: path, title: street.streetName },
    ]
    const items = street.houses.map((house) => ({
      href: `${path}/${house.houseSlug}`,
      title: `${street.streetName}, ${house.houseNumber}`,
      meta: `${house.reviewCount} ${reviewsWord(house.reviewCount)}`,
    }))

    const rating =
      street.ratingAvg === null ? '' : ` · средняя оценка ${formatRating(street.ratingAvg)}`
    const body = renderPage(
      crumbs,
      `<h1>${escapeHtml(`${street.streetName}, ${street.cityName} — отзывы жильцов`)}</h1>
<p class="page__summary">${escapeHtml(
        `${street.reviewCount} ${reviewsWord(street.reviewCount)} о ${street.houseCount} ${housesWord(street.houseCount)}${rating}`,
      )}</p>
${renderList(items)}`,
    )

    return this.renderService.render(
      {
        title: `${street.streetName}, ${street.cityName} — отзывы о съёмных квартирах`,
        description: `Отзывы жильцов о ${street.houseCount} ${housesWord(street.houseCount)} на улице ${street.streetName} в ${cityIn(street.cityName)}.`,
        canonicalPath: path,
        jsonLd: [
          this.crumbsSchema(crumbs),
          collectionPage({
            name: `Дома на улице ${street.streetName}`,
            url: this.renderService.absoluteUrl(path),
            items: items.map((item) => ({
              name: item.title,
              url: this.renderService.absoluteUrl(item.href),
            })),
          }),
        ],
      },
      body,
    )
  }

  /** Дом со всеми подтверждёнными отзывами — главная посадочная страница */
  @Get(':citySlug/:streetSlug/:houseSlug')
  @Header('Cache-Control', 'no-cache')
  async house(
    @Param('citySlug') citySlug: string,
    @Param('streetSlug') streetSlug: string,
    @Param('houseSlug') houseSlug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    res.type('html')

    const house = await this.catalogService.findHouse(citySlug, streetSlug, houseSlug)
    if (!house) {
      return this.notFound(
        res,
        [
          { href: '/', title: 'Главная' },
          { href: `/${citySlug}`, title: citySlug },
          { href: `/${citySlug}/${streetSlug}`, title: streetSlug },
        ],
        'Дом не найден',
      )
    }

    const path = `/${citySlug}/${streetSlug}/${houseSlug}`
    const title = `${house.streetName}, ${house.houseNumber}`
    const crumbs: PageLink[] = [
      { href: '/', title: 'Главная' },
      { href: `/${citySlug}`, title: house.cityName },
      { href: `/${citySlug}/${streetSlug}`, title: house.streetName },
      { href: path, title: house.houseNumber },
    ]

    const apartments = house.apartments.map((apartment) => ({
      href: `#kv-${apartment.id}`,
      title: `Квартира ${apartment.number}, подъезд ${apartment.entrance}`,
      meta: `${apartment.reviewCount} ${reviewsWord(apartment.reviewCount)}`,
    }))

    const body = renderPage(
      crumbs,
      `<h1>${escapeHtml(`${title} — отзывы жильцов`)}</h1>
<p class="page__summary">${escapeHtml(house.address)}</p>
${apartments.length > 0 ? `<h2>Квартиры с отзывами</h2>\n${renderList(apartments)}` : ''}
${
  house.reviewCount === 0
    ? '<p class="page__note">Отзывы об этом доме пока на проверке — они появятся здесь после модерации.</p>'
    : `<h2>${escapeHtml(
        `${house.reviewCount} ${reviewsWord(house.reviewCount)} о ${house.apartments.length} ${apartmentsWord(house.apartments.length)}`,
      )}</h2>
<div class="page__reviews">
${house.reviews.map((review) => renderReview(review)).join('\n')}
</div>`
}`,
    )

    return this.renderService.render(
      {
        title:
          house.reviewCount > 0
            ? `${title}, ${house.cityName} — ${house.reviewCount} ${reviewsWord(house.reviewCount)} жильцов`
            : `${title}, ${house.cityName} — отзывы жильцов`,
        description: describeHouse(house.reviewCount, house.ratingAvg, title, house.cityName),
        canonicalPath: path,
        // Дом заведён, но подтверждённых отзывов нет: индексировать нечего,
        // а ссылки с неё роботу проходить можно
        noindex: house.reviewCount === 0,
        jsonLd: [
          this.crumbsSchema(crumbs),
          houseSchema(house, this.renderService.absoluteUrl(path)),
        ],
      },
      body,
    )
  }

  /**
   * Страница «не найдено» с настоящим кодом 404.
   *
   * Отдавать здесь 200 нельзя: «мягкая» 404 — страница-заглушка с успешным
   * кодом — засоряет индекс и портит доверие к сайту в целом.
   */
  private notFound(res: Response, crumbs: PageLink[], title: string): Promise<string> {
    res.status(404)
    const body = renderPage([...crumbs, { href: '', title: 'Не найдено' }], `<h1>${escapeHtml(title)}</h1>
<p class="page__summary">Возможно, дом ещё не появился в каталоге: он попадает сюда после первого проверенного отзыва.</p>
<p><a class="btn-secondary" href="/">Открыть карту</a></p>`)

    return this.renderService.render(
      {
        title: `${title} — flatnik`,
        description: 'Такой страницы нет. Выберите город и найдите дом на карте отзывов.',
        canonicalPath: '/',
        noindex: true,
      },
      body,
    )
  }

  private crumbsSchema(crumbs: PageLink[]): unknown {
    return breadcrumbList(
      crumbs.map((crumb) => ({
        name: crumb.title,
        url: this.renderService.absoluteUrl(crumb.href),
      })),
    )
  }
}

/** Описание страницы дома: оценка вперёд — в выдаче она заметнее */
function describeHouse(
  reviewCount: number,
  ratingAvg: number | null,
  title: string,
  cityName: string,
): string {
  if (reviewCount === 0) {
    return `${title}, ${cityName}. Отзывы жильцов появятся после проверки модератором.`
  }
  const rating = ratingAvg === null ? '' : `Оценка ${formatRating(ratingAvg)} из 5. `
  return `${rating}${reviewCount} ${reviewsWord(reviewCount)} бывших жильцов о квартирах и подъездах: ${title}, ${cityIn(cityName)}.`
}
