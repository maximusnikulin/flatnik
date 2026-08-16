import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { LessThan, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { MobileIdService } from '../sms/mobile-id.service'
import { SmsService } from '../sms/sms.service'
import { UsersService } from '../users/users.service'
import { AuthCode } from './auth-code.entity'
import type { AuthChannel } from './auth-code.entity'
import type { User } from '../users/user.entity'
import type { JwtPayload } from './auth.types'

/** Срок жизни начатой попытки входа */
const CODE_TTL_MS = 5 * 60 * 1000

/** Пауза между попытками входа на один номер: каждая стоит денег */
const REQUEST_INTERVAL_MS = 60 * 1000

/** Неудачных попыток ввода, после которых код аннулируется */
const MAX_ATTEMPTS = 5

/**
 * Не чаще этого спрашиваем статус у провайдера. Фронт опрашивает раз в три
 * секунды, так что для него ограничение незаметно — оно против прямых запросов.
 */
const POLL_INTERVAL_MS = 2000

/** Что показывать пользователю после запроса входа */
export interface StartedAuth {
  method: AuthChannel
  /** Человеку пришёл код и его надо ввести; иначе он подтверждает вход на телефоне */
  needsCode: boolean
  /** Секрет для опроса статуса */
  sessionId: string
}

export type SessionResult =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'confirmed'; accessToken: string; user: User }

/** Сравнение секретов постоянного времени: длина сверяется отдельно */
function secretsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectRepository(AuthCode)
    private readonly authCodes: Repository<AuthCode>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly mobileIdService: MobileIdService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Начинает вход: заводит у провайдера заявку на мобильную авторизацию, а если
   * для номера она недоступна — откатывается на код в Telegram.
   *
   * Порядок шагов важен. Пауза проверяется до капчи: дёргать Яндекс ради заведомо
   * отклонённого запроса незачем. Капча — до обращения к провайдеру, потому что
   * это единственный шаг, заставляющий систему потратить деньги и побеспокоить
   * владельца номера, и перезапрос иначе сбрасывал бы попытку, уже начатую
   * человеком. Запись сохраняется последней: если провайдер не принял запрос,
   * человек не должен остаться с паузой на минуту и заявкой, которой не было.
   */
  async requestCode(phone: string, captchaToken?: string, ip?: string): Promise<StartedAuth> {
    // Просроченные попытки не нужны никому. Строка живёт, пока не истекло хотя бы одно
    // из двух: сама попытка или пауза — иначе исчерпанные попытки обнуляли бы паузу
    // и следующую (платную) авторизацию можно было бы вызвать сразу.
    const now = new Date()
    await this.authCodes.delete({ expiresAt: LessThan(now), nextRequestAt: LessThan(now) })

    const pending = await this.authCodes.findOneBy({ phone })
    if (pending && pending.nextRequestAt > now) {
      const seconds = Math.ceil((pending.nextRequestAt.getTime() - now.getTime()) / 1000)
      // Отдельного TooManyRequestsException в Nest нет
      throw new HttpException(
        `Вход уже запрошен, повторите через ${seconds} с`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    await this.captchaService.validate(captchaToken, ip)

    const mobileId = await this.mobileIdService.start(phone)

    let channel: AuthChannel = 'mobile-id'
    let needsCode = true
    let code: string | null = null

    if (!mobileId) {
      // Мобильная авторизация не для всех операторов: отказ провайдера включает
      // запасной путь, а не закрывает вход
      channel = 'code'
      // Диапазон 100000–999999, а не padStart от нуля: провайдер принимает код
      // числом, и «012345» уехало бы к нему как пятизначное 12345
      code = String(100_000 + Math.floor(Math.random() * 900_000))
      if (this.smsService.isEnabled) {
        // Текст — для каскадной SMS, если код не доставили в Telegram. Источник
        // в нём обязателен, пока имя отправителя не своё, а бесплатное, поэтому
        // домен остаётся в скобках рядом с названием сервиса
        await this.smsService.sendCode(
          phone,
          code,
          `Код для входа на Квартирник (flatnik.ru): ${code}`,
        )
      } else {
        this.logger.warn(`Доступы SMS Aero не заданы — код для ${phone}: ${code}`)
      }
    } else {
      needsCode = mobileId.needsCode
    }

    const startedAt = Date.now()
    const sessionId = randomBytes(16).toString('hex')
    // upsert, а не save: двойной клик иначе гонялся бы между select и insert
    await this.authCodes.upsert(
      {
        phone,
        channel,
        requestId: mobileId?.requestId ?? null,
        code,
        pollSecret: sessionId,
        lastPollAt: null,
        expiresAt: new Date(startedAt + CODE_TTL_MS),
        nextRequestAt: new Date(startedAt + REQUEST_INTERVAL_MS),
        attempts: 0,
      },
      ['phone'],
    )

    return { method: channel, needsCode, sessionId }
  }

  /**
   * Спрашивает провайдера, подтвердил ли человек вход на телефоне. Единственный
   * способ узнать результат SIM-PUSH: вводом он не сопровождается.
   *
   * Чужой номер так не опросить: нужен секрет, выданный тому, кто вход начал.
   * Не сошёлся — отвечаем «истекло», а не «нет доступа»: разные ответы
   * подсказывали бы перебирающему, что вход по номеру сейчас идёт.
   */
  async pollSession(phone: string, sessionId: string): Promise<SessionResult> {
    const pending = await this.authCodes.findOneBy({ phone })
    if (!pending || !secretsMatch(pending.pollSecret, sessionId)) {
      return { status: 'expired' }
    }
    if (pending.expiresAt < new Date()) {
      return { status: 'expired' }
    }
    // Запасной путь подтверждается вводом кода, спрашивать о нём провайдера нечего
    if (pending.channel !== 'mobile-id' || !pending.requestId) {
      return { status: 'pending' }
    }
    if (pending.lastPollAt && Date.now() - pending.lastPollAt.getTime() < POLL_INTERVAL_MS) {
      return { status: 'pending' }
    }

    await this.authCodes.update({ phone }, { lastPollAt: new Date() })
    const { confirmed } = await this.mobileIdService.status(pending.requestId)
    if (!confirmed) {
      return { status: 'pending' }
    }

    const session = await this.issueToken(phone)
    return { status: 'confirmed', ...session }
  }

  /**
   * Проверяет код. У мобильной авторизации код выдал провайдер — он же его и
   * проверяет; у запасного пути код наш и сверяется здесь.
   */
  async verifyCode(phone: string, code: string): Promise<{ accessToken: string; user: User }> {
    const pending = await this.authCodes.findOneBy({ phone })
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException('Неверный или истёкший код')
    }

    const isValid =
      pending.channel === 'mobile-id' && pending.requestId
        ? await this.mobileIdService.verify(pending.requestId, code)
        : pending.code === code

    if (!isValid) {
      // Шесть цифр перебираются, поэтому попытки считаем и на пределе код гасим.
      // Текст ошибки общий: разные сообщения подсказывали бы боту, что номер угадан.
      const attempts = pending.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        // Гасим попытку сроком, а не удалением строки: пауза до следующей
        // авторизации должна пережить исчерпанные попытки, иначе перебор
        // и оплачивал бы сам себя
        await this.authCodes.update({ phone }, { attempts, expiresAt: new Date() })
        throw new UnauthorizedException('Слишком много попыток, запросите новый код')
      }
      await this.authCodes.update({ phone }, { attempts })
      throw new UnauthorizedException('Неверный или истёкший код')
    }

    return this.issueToken(phone)
  }

  /** Общий финал обоих путей входа: попытка закрыта, пользователь получает токен */
  private async issueToken(phone: string): Promise<{ accessToken: string; user: User }> {
    await this.authCodes.delete({ phone })

    const user = await this.usersService.getOrCreateByPhone(phone)
    const payload: JwtPayload = { sub: user.id }
    const accessToken = await this.jwtService.signAsync(payload)
    return { accessToken, user }
  }
}
