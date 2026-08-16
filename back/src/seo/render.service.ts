import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { seoConfig } from '../config/seo.config'
import { escapeAttr, escapeHtml, serializeJsonLd } from './html.util'
import { IndexTemplateService } from './index-template.service'

/** Мета страницы; путь — без домена, абсолютные адреса собирает сам сервис */
export interface PageMeta {
  title: string
  description: string
  canonicalPath: string
  /** Страница не должна попадать в индекс, но ссылки с неё роботу проходить можно */
  noindex?: boolean
  /** Объекты schema.org; каждый уедет в отдельный script */
  jsonLd?: unknown[]
}

const HEAD_MARKER = '<!--seo-head-->'
const BODY_MARKER = '<!--seo-body-->'

/** Запасные точки вставки, если маркеры не пережили сборку */
const HEAD_FALLBACK = '</head>'
const ROOT_FALLBACK = /<div id="root"[^>]*>\s*<\/div>/

const TITLE_TAG = /<title>[\s\S]*?<\/title>/
const DESCRIPTION_TAG = /<meta\s+name="description"[^>]*>/

/** Картинка для соцсетей; лежит в статике фронта */
const OG_IMAGE_PATH = '/og-cover.png'

@Injectable()
export class RenderService {
  constructor(
    private readonly template: IndexTemplateService,
    @Inject(seoConfig.KEY)
    private readonly config: ConfigType<typeof seoConfig>,
  ) {}

  /** Абсолютный адрес страницы: нужен и для canonical, и для разметки */
  absoluteUrl(path: string): string {
    return `${this.config.baseUrl}${path}`
  }

  /** Готовая страница: шаблон фронта с подставленной метой и разметкой */
  async render(meta: PageMeta, body: string): Promise<string> {
    let html = await this.template.load()

    // Title и description именно заменяются, а не дописываются: два <title> на
    // странице — и поисковик возьмёт первый, то есть общий для всего сайта
    html = html.replace(TITLE_TAG, `<title>${escapeHtml(meta.title)}</title>`)
    html = html.replace(
      DESCRIPTION_TAG,
      `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    )

    const head = this.headTags(meta)
    html = html.includes(HEAD_MARKER)
      ? html.replace(HEAD_MARKER, head)
      : html.replace(HEAD_FALLBACK, `${head}${HEAD_FALLBACK}`)

    // Разметка кладётся внутрь корневого элемента приложения. Снаружи она
    // осталась бы на экране навсегда: React очищает только свой контейнер.
    html = html.includes(BODY_MARKER)
      ? html.replace(BODY_MARKER, body)
      : html.replace(ROOT_FALLBACK, `<div id="root">${body}</div>`)

    return html
  }

  private headTags(meta: PageMeta): string {
    const url = this.absoluteUrl(meta.canonicalPath)
    const tags = [
      `<link rel="canonical" href="${escapeAttr(url)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="Квартирник" />`,
      `<meta property="og:locale" content="ru_RU" />`,
      `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
      `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
      `<meta property="og:url" content="${escapeAttr(url)}" />`,
      `<meta property="og:image" content="${escapeAttr(this.absoluteUrl(OG_IMAGE_PATH))}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
    ]

    if (meta.noindex) {
      tags.push('<meta name="robots" content="noindex, follow" />')
    }

    for (const item of meta.jsonLd ?? []) {
      tags.push(`<script type="application/ld+json">${serializeJsonLd(item)}</script>`)
    }

    return tags.join('\n    ')
  }
}
