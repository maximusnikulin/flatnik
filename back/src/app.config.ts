import { ValidationPipe } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'

export const API_PREFIX = 'api'

/**
 * Общая настройка приложения. Применяется и при старте сервера, и при выгрузке
 * OpenAPI-схемы, чтобы пути в схеме совпадали с реальными.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX)

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )
}
