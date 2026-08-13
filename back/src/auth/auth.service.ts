import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { LessThan, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { SmsService } from '../sms/sms.service'
import { UsersService } from '../users/users.service'
import { AuthCode } from './auth-code.entity'
import type { User } from '../users/user.entity'
import type { JwtPayload } from './auth.types'

/** Срок жизни кода подтверждения */
const CODE_TTL_MS = 5 * 60 * 1000

/** Пауза между запросами кода на один номер: каждая SMS стоит денег */
const REQUEST_INTERVAL_MS = 60 * 1000

/** Неудачных попыток ввода, после которых код аннулируется */
const MAX_ATTEMPTS = 5

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectRepository(AuthCode)
    private readonly authCodes: Repository<AuthCode>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Выдаёт код и отправляет его в Telegram (с каскадом в SMS, если задано своё
   * имя отправителя).
   *
   * Порядок шагов важен. Пауза проверяется до капчи: дёргать Яндекс ради заведомо
   * отклонённого запроса незачем. Капча — до генерации кода, потому что это
   * единственный шаг, заставляющий систему потратить деньги и побеспокоить
   * владельца номера, и перезапрос бота иначе сбрасывал бы код, уже выданный
   * человеку. Запись сохраняется последней: если провайдер не принял сообщение,
   * человек не должен остаться с кодом, которого не получал, и паузой на минуту.
   */
  async requestCode(phone: string, captchaToken?: string, ip?: string): Promise<void> {
    // Просроченные коды не нужны никому. Строка живёт, пока не истекло хотя бы одно
    // из двух: сам код или пауза — иначе исчерпанные попытки обнуляли бы паузу
    // и следующую SMS можно было бы вызвать сразу.
    const now = new Date()
    await this.authCodes.delete({ expiresAt: LessThan(now), nextRequestAt: LessThan(now) })

    const pending = await this.authCodes.findOneBy({ phone })
    if (pending && pending.nextRequestAt > now) {
      const seconds = Math.ceil((pending.nextRequestAt.getTime() - now.getTime()) / 1000)
      // Отдельного TooManyRequestsException в Nest нет
      throw new HttpException(
        `Код уже отправлен, повторите через ${seconds} с`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    await this.captchaService.validate(captchaToken, ip)

    // Диапазон 100000–999999, а не padStart от нуля: провайдер принимает код
    // числом, и «012345» уехало бы к нему как пятизначное 12345
    const code = String(100_000 + Math.floor(Math.random() * 900_000))
    if (this.smsService.isEnabled) {
      // Текст — для каскадной SMS, если код не доставили в Telegram. Источник
      // в нём обязателен, пока имя отправителя не своё, а бесплатное
      await this.smsService.sendCode(phone, code, `Код для входа на flatnik.ru: ${code}`)
    } else {
      this.logger.warn(`Доступы SMS Aero не заданы — код для ${phone}: ${code}`)
    }

    const sentAt = Date.now()
    // upsert, а не save: двойной клик иначе гонялся бы между select и insert
    await this.authCodes.upsert(
      {
        phone,
        code,
        expiresAt: new Date(sentAt + CODE_TTL_MS),
        nextRequestAt: new Date(sentAt + REQUEST_INTERVAL_MS),
        attempts: 0,
      },
      ['phone'],
    )
  }

  async verifyCode(phone: string, code: string): Promise<{ accessToken: string; user: User }> {
    const pending = await this.authCodes.findOneBy({ phone })
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException('Неверный или истёкший код')
    }

    if (pending.code !== code) {
      // Шесть цифр перебираются, поэтому попытки считаем и на пределе код гасим.
      // Текст ошибки общий: разные сообщения подсказывали бы боту, что номер угадан.
      const attempts = pending.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        // Гасим код сроком, а не удалением строки: пауза до следующей SMS должна
        // пережить исчерпанные попытки, иначе перебор и оплачивал бы сам себя
        await this.authCodes.update({ phone }, { attempts, expiresAt: new Date() })
        throw new UnauthorizedException('Слишком много попыток, запросите новый код')
      }
      await this.authCodes.update({ phone }, { attempts })
      throw new UnauthorizedException('Неверный или истёкший код')
    }

    await this.authCodes.delete({ phone })

    const user = await this.usersService.getOrCreateByPhone(phone)
    const payload: JwtPayload = { sub: user.id }
    const accessToken = await this.jwtService.signAsync(payload)
    return { accessToken, user }
  }
}
