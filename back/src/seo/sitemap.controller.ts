import { Controller, Get, Header, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { SitemapService } from './sitemap.service'

/**
 * Карта сайта. Живёт под /api, как и весь бэкенд; наружу гейтвей отдаёт её по
 * привычному адресу /sitemap.xml — именно его ищут поисковики и указывает
 * robots.txt.
 */
@ApiExcludeController()
@Controller('seo')
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Get('sitemap.xml')
  // Час кеша: список домов меняется медленно, а обходят карту часто
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemap(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.type('application/xml')
    return this.sitemapService.build()
  }
}
