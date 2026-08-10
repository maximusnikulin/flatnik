import { registerAs } from '@nestjs/config'
import type { StringValue } from 'ms'

/**
 * Срок жизни токена в формате пакета ms ('30d', '12h') или секундах ('3600').
 * Тип StringValue требует jsonwebtoken; значение из env сужаем осознанно.
 */
function parseExpiresIn(value: string | undefined): number | StringValue {
  if (!value) return '30d'
  if (/^\d+$/.test(value)) return Number(value)
  return value as StringValue
}

/** Параметры JWT; дефолтный секрет годится только для разработки */
export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? 'flatnik-dev-secret',
  jwtExpiresIn: parseExpiresIn(process.env.JWT_EXPIRES_IN),
}))
