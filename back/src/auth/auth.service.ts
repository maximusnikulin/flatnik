import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '../users/users.service'
import type { User } from '../users/user.entity'
import type { JwtPayload } from './auth.types'

interface PendingCode {
  code: string
  expiresAt: number
}

/** Срок жизни кода подтверждения */
const CODE_TTL_MS = 5 * 60 * 1000

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  /**
   * Заглушка вместо SMS: коды живут в памяти процесса и печатаются в лог.
   * Одна нода, рестарт сбрасывает выданные коды. Для продакшена заменить
   * на SMS-провайдера и внешнее хранилище.
   */
  private readonly pendingCodes = new Map<string, PendingCode>()

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  requestCode(phone: string): void {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    this.pendingCodes.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS })
    // Тот самый лог, из которого берётся код вместо SMS
    this.logger.log(`Код подтверждения для ${phone}: ${code}`)
  }

  async verifyCode(phone: string, code: string): Promise<{ accessToken: string; user: User }> {
    const pending = this.pendingCodes.get(phone)
    if (!pending || pending.expiresAt < Date.now() || pending.code !== code) {
      throw new UnauthorizedException('Неверный или истёкший код')
    }
    this.pendingCodes.delete(phone)

    const user = await this.usersService.getOrCreateByPhone(phone)
    const payload: JwtPayload = { sub: user.id }
    const accessToken = await this.jwtService.signAsync(payload)
    return { accessToken, user }
  }
}
