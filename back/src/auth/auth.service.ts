import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { CaptchaService } from '../captcha/captcha.service'
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
    private readonly captchaService: CaptchaService,
  ) {}

  /**
   * Капча стоит на выдаче кода, а не на его проверке: это единственный шаг,
   * заставляющий систему отправить SMS — то есть тратить деньги и беспокоить
   * владельца номера. Проверяем до генерации, иначе перезапрос бота сбрасывал
   * бы код, уже выданный человеку на тот же телефон.
   */
  async requestCode(phone: string, captchaToken?: string, ip?: string): Promise<void> {
    await this.captchaService.validate(captchaToken, ip)

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
