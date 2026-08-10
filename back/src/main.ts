import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { configureApp, API_PREFIX } from './app.config'
import { buildOpenApiDocument } from './openapi/document'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  configureApp(app)
  app.enableCors({ origin: true })

  if (process.env.SWAGGER_UI !== 'off') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app))
  }

  const port = Number(process.env.PORT) || 3000
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
