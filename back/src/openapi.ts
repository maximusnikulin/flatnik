import 'reflect-metadata'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { configureApp } from './app.config'
import { buildOpenApiDocument } from './openapi/document'

const OUTPUT = resolve(__dirname, '../../shared/openapi.json')

/**
 * Выгрузка OpenAPI-схемы в файл. Приложение поднимается без listen():
 * нужен только собранный контейнер зависимостей и метаданные маршрутов.
 */
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false })
  configureApp(app)
  await app.init()

  const document = buildOpenApiDocument(app)

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`)

  await app.close()

  process.stdout.write(`OpenAPI schema written to ${OUTPUT}\n`)
}

generate().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
