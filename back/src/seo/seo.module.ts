import { Module } from '@nestjs/common'
import { CatalogModule } from '../catalog/catalog.module'
import { IndexTemplateService } from './index-template.service'
import { RenderService } from './render.service'
import { SeoController } from './seo.controller'
import { SitemapController } from './sitemap.controller'
import { SitemapService } from './sitemap.service'

// Данные берутся из CatalogService напрямую: страница и её JSON-аналог обязаны
// показывать одно и то же, а HTTP-запрос сервера к самому себе был бы лишним.
@Module({
  imports: [CatalogModule],
  controllers: [SeoController, SitemapController],
  providers: [IndexTemplateService, RenderService, SitemapService],
})
export class SeoModule {}
