import type { Request } from 'express'

/** Полезная нагрузка JWT: sub — id пользователя */
export interface JwtPayload {
  sub: string
}

/** Запрос, прошедший JwtAuthGuard */
export interface AuthenticatedRequest extends Request {
  userId: string
}
