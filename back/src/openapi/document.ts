import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { OpenAPIObject } from '@nestjs/swagger'

/**
 * Единая сборка OpenAPI-документа: используется и для Swagger UI в рантайме,
 * и для выгрузки схемы в shared/openapi.json.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('flatnik API')
    .setDescription('HTTP-контракт бэкенда flatnik')
    .setVersion('0.0.0')
    .addBearerAuth()
    .build()

  return SwaggerModule.createDocument(app, config)
}
