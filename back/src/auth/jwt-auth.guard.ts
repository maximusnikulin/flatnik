import { Injectable, UnauthorizedException } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { AuthenticatedRequest, JwtPayload } from './auth.types'

/**
 * Проверяет Bearer-токен и кладёт userId в запрос.
 * Без passport: заглушке телефонной авторизации хватает голого @nestjs/jwt.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const header = request.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
    if (!token) {
      throw new UnauthorizedException('Требуется авторизация')
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token)
      const authRequest = request as AuthenticatedRequest
      authRequest.userId = payload.sub
    } catch {
      throw new UnauthorizedException('Токен недействителен или истёк')
    }
    return true
  }
}
