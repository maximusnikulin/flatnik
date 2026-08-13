import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { configureApp, API_PREFIX } from './app.config'
import { buildOpenApiDocument } from './openapi/document'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Между клиентом и бэком стоят edge и gateway, поэтому socket-адрес — это адрес
  // контейнера, а настоящий IP едет в X-Forwarded-For (nginx/prod.conf.template).
  // Он уходит в проверку капчи, и без этой строки Яндекс получал бы docker-адрес.
  // 'uniquelocal' = доверяем только приватным диапазонам, то есть своим прокси.
  app.set('trust proxy', 'uniquelocal')

  configureApp(app)
  app.enableCors({ origin: true })

  if (process.env.SWAGGER_UI !== 'off') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app))
  }

  const port = Number(process.env.PORT) || 3000
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
