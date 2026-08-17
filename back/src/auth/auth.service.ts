import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { LessThan, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { MobileIdService, MobileIdStatus, toOutcome } from '../mobile-id/mobile-id.service'
import { UsersService } from '../users/users.service'
import { AuthCode } from './auth-code.entity'
import type { User } from '../users/user.entity'
import type { JwtPayload } from './auth.types'

/** Срок жизни начатой попытки входа */
const CODE_TTL_MS = 5 * 60 * 1000

/** Пауза между попытками входа на один номер: каждая стоит денег */
const REQUEST_INTERVAL_MS = 60 * 1000

/** Неудачных попыток ввода, после которых попытка аннулируется */
const MAX_ATTEMPTS = 5

/**
 * Не чаще этого спрашиваем статус у провайдера. Фронт опрашивает раз в три
 * секунды, так что для него ограничение незаметно — оно против прямых запросов.
 */
const POLL_INTERVAL_MS = 2000

/** Что показывать пользователю после запроса входа */
export interface StartedAuth {
  /** Секрет для опроса статуса */
  sessionId: string
}

export type SessionResult =
  | { status: 'pending' }
  /** SIM-PUSH не сработал, провайдер прислал код в SMS — показать поле ввода */
  | { status: 'needs-code' }
  /** Аутентификация не пройдена: нужен новый запрос */
  | { status: 'failed' }
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
  ) {}

  /**
   * Начинает вход: заводит у провайдера заявку на мобильную авторизацию.
   * Дальше человек либо подтверждает вход прямо на SIM-карте, либо — если
   * SIM-PUSH не сработал — получает от провайдера код в SMS. Что именно
   * произошло, на этом шаге ещё неизвестно: узнаём опросом статуса.
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

    // Секрет выдаём до заявки: он уходит провайдеру в callbackUrl и там же
    // аутентифицирует webhook, поэтому должен быть известен раньше вызова
    const sessionId = randomBytes(16).toString('hex')
    // Провайдер недоступен или отказал — это 503 из MobileIdService: запасного
    // пути больше нет, и притворяться, что вход начат, нельзя
    const request = await this.mobileIdService.start(phone, this.mobileIdService.callbackUrl(sessionId))

    const startedAt = Date.now()
    // upsert, а не save: двойной клик иначе гонялся бы между select и insert
    await this.authCodes.upsert(
      {
        phone,
        requestId: request.requestId,
        providerStatus: request.status,
        needsRecheck: false,
        pollSecret: sessionId,
        lastPollAt: null,
        expiresAt: new Date(startedAt + CODE_TTL_MS),
        nextRequestAt: new Date(startedAt + REQUEST_INTERVAL_MS),
        attempts: 0,
      },
      ['phone'],
    )

    return { sessionId }
  }

  /**
   * Спрашивает, чем кончилась заявка. Единственный способ узнать результат
   * SIM-PUSH: вводом он не сопровождается. Он же сообщает, что провайдер
   * перешёл на код в SMS и пора показать поле ввода.
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

    // Уже известный конечный статус повторно у провайдера не спрашиваем
    const known = toOutcome(pending.providerStatus)
    if (known === 'confirmed') {
      return this.confirm(phone)
    }
    if (known === 'failed') {
      return { status: 'failed' }
    }

    // Троттлинг опроса. Webhook о смене статуса его отменяет: раз провайдер
    // уже сообщил, что что-то изменилось, ждать паузу незачем
    const throttled =
      pending.lastPollAt !== null && Date.now() - pending.lastPollAt.getTime() < POLL_INTERVAL_MS
    if (throttled && !pending.needsRecheck) {
      return { status: known === 'needs-code' ? 'needs-code' : 'pending' }
    }

    await this.authCodes.update({ phone }, { lastPollAt: new Date(), needsRecheck: false })
    const { outcome, status } = await this.mobileIdService.status(pending.requestId)
    await this.authCodes.update({ phone }, { providerStatus: status })

    if (outcome === 'confirmed') {
      return this.confirm(phone)
    }
    if (outcome === 'failed') {
      this.logger.warn(`Заявка ${pending.requestId}: аутентификация не пройдена (статус ${status})`)
      return { status: 'failed' }
    }
    return { status: outcome === 'needs-code' ? 'needs-code' : 'pending' }
  }

  /**
   * Проверяет одноразовый код. Код выдал провайдер — он же его и проверяет:
   * своего кода у нас нет.
   */
  async verifyCode(phone: string, code: string): Promise<{ accessToken: string; user: User }> {
    const pending = await this.authCodes.findOneBy({ phone })
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException('Неверный или истёкший код')
    }

    const isValid = await this.mobileIdService.verify(pending.requestId, code)

    if (!isValid) {
      // Код перебирается, поэтому попытки считаем и на пределе заявку гасим.
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

    await this.authCodes.update({ phone }, { providerStatus: MobileIdStatus.Confirmed })
    return this.issueToken(phone)
  }

  /**
   * Отмечает заявку как требующую перепроверки. Вызывается приёмником webhook,
   * который сам по себе ничего не решает: тело приходит без подписи, поэтому
   * статус мы всё равно спрашиваем у провайдера.
   *
   * Секрет из адреса сверяем здесь же — по нему и находится заявка.
   */
  async markForRecheck(sessionId: string, requestId: string): Promise<boolean> {
    const pending = await this.authCodes.findOneBy({ pollSecret: sessionId })
    if (!pending || pending.requestId !== requestId) {
      return false
    }
    await this.authCodes.update({ phone: pending.phone }, { needsRecheck: true })
    return true
  }

  /** Подтверждённая заявка превращается в токен */
  private async confirm(phone: string): Promise<SessionResult> {
    const session = await this.issueToken(phone)
    return { status: 'confirmed', ...session }
  }

  /** Общий финал входа: попытка закрыта, пользователь получает токен */
  private async issueToken(phone: string): Promise<{ accessToken: string; user: User }> {
    await this.authCodes.delete({ phone })

    const user = await this.usersService.getOrCreateByPhone(phone)
    const payload: JwtPayload = { sub: user.id }
    const accessToken = await this.jwtService.signAsync(payload)
    return { accessToken, user }
  }
}
