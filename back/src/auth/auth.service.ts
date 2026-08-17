import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { LessThan, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { MailService } from '../mail/mail.service'
import { MobileIdService, toOutcome } from '../mobile-id/mobile-id.service'
import { UsersService } from '../users/users.service'
import { AuthCode } from './auth-code.entity'
import type { AuthCodeKind } from './auth-code.entity'
import type { User } from '../users/user.entity'
import type { JwtPayload } from './auth.types'

/** Срок жизни начатой попытки входа */
const CODE_TTL_MS = 5 * 60 * 1000

/** Пауза между попытками на один идентификатор: телефонная стоит денег */
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
  /** Код отправлен и его ждут: SMS от провайдера или наш код на почту */
  | { status: 'needs-code' }
  /** Аутентификация не пройдена: нужен новый запрос */
  | { status: 'failed' }
  | { status: 'expired' }
  | { status: 'confirmed'; accessToken: string; user: User }

/** Чем вошли. Разбирается из одной строки, которую человек ввёл в поле входа */
export type LoginKind = 'phone' | 'email'

/** Сравнение секретов постоянного времени: длина сверяется отдельно */
function secretsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Шестизначный код. Диапазон 100000–999999, а не padStart от нуля: так у кода
 * всегда шесть значащих цифр и он не превращается в пятизначный при пересылке
 * числом.
 */
function generateCode(): string {
  return String(100_000 + Math.floor(Math.random() * 900_000))
}

/**
 * Что за идентификатор ввели. Собачка — единственный надёжный признак: телефон
 * её содержать не может, а точные формы обоих проверяет DTO.
 */
export function detectLoginKind(login: string): LoginKind {
  return login.includes('@') ? 'email' : 'phone'
}

/** Почта хранится и сравнивается в нижнем регистре */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
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
    private readonly mailService: MailService,
  ) {}

  /**
   * Начинает вход телефоном или почтой — что именно, решает вид идентификатора.
   *
   * Порядок шагов важен. Пауза проверяется до капчи: дёргать Яндекс ради заведомо
   * отклонённого запроса незачем. Капча — до отправки, потому что это единственный
   * шаг, заставляющий систему потратить деньги и побеспокоить владельца адреса,
   * и перезапрос иначе сбрасывал бы попытку, уже начатую человеком. Запись
   * сохраняется последней: если отправить не удалось, человек не должен остаться
   * с паузой на минуту и заявкой, которой не было.
   */
  async requestCode(login: string, captchaToken?: string, ip?: string): Promise<StartedAuth> {
    const kind = detectLoginKind(login)
    const identifier = kind === 'email' ? normalizeEmail(login) : login
    const codeKind: AuthCodeKind = kind === 'email' ? 'email-login' : 'phone'

    await this.assertNotThrottled(identifier, codeKind)
    await this.captchaService.validate(captchaToken, ip)

    // Секрет выдаём до заявки: он уходит провайдеру в callbackUrl и там же
    // аутентифицирует webhook, поэтому должен быть известен раньше вызова
    const sessionId = randomBytes(16).toString('hex')

    if (kind === 'email') {
      const code = generateCode()
      await this.mailService.send(
        identifier,
        'Код для входа на Квартирник',
        `Ваш код для входа: ${code}\n\nКод действует пять минут. Если вход запрашивали не вы, просто удалите это письмо.`,
      )
      await this.saveAttempt({ identifier, kind: codeKind, sessionId, code })
      return { sessionId }
    }

    // Провайдер недоступен или отказал — это 503 из MobileIdService: запасного
    // пути нет, и притворяться, что вход начат, нельзя
    const request = await this.mobileIdService.start(
      identifier,
      this.mobileIdService.callbackUrl(sessionId),
    )
    await this.saveAttempt({
      identifier,
      kind: codeKind,
      sessionId,
      requestId: request.requestId,
      providerStatus: request.status,
    })
    return { sessionId }
  }

  /**
   * Спрашивает, чем кончилась заявка. Для телефона это единственный способ
   * узнать результат SIM-PUSH: вводом он не сопровождается. Он же сообщает,
   * что пора показать поле ввода кода.
   *
   * Чужую попытку так не опросить: нужен секрет, выданный тому, кто вход начал.
   * Не сошёлся — отвечаем «истекло», а не «нет доступа»: разные ответы
   * подсказывали бы перебирающему, что вход по этому адресу сейчас идёт.
   */
  async pollSession(login: string, sessionId: string): Promise<SessionResult> {
    const kind = detectLoginKind(login)
    const identifier = kind === 'email' ? normalizeEmail(login) : login
    const codeKind: AuthCodeKind = kind === 'email' ? 'email-login' : 'phone'

    const pending = await this.authCodes.findOneBy({ identifier, kind: codeKind })
    if (!pending || !secretsMatch(pending.pollSecret, sessionId)) {
      return { status: 'expired' }
    }
    if (pending.expiresAt < new Date()) {
      return { status: 'expired' }
    }

    // Почтовый код отправлен ещё на запросе — ждать нечего, сразу поле ввода.
    // Благодаря этому машина состояний на фронте одна на оба способа входа
    if (pending.kind !== 'phone' || !pending.requestId) {
      return { status: 'needs-code' }
    }

    // Уже известный конечный статус повторно у провайдера не спрашиваем
    const known = toOutcome(pending.providerStatus)
    if (known === 'confirmed') {
      return this.confirmPhone(identifier)
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

    const key = { identifier, kind: codeKind }
    await this.authCodes.update(key, { lastPollAt: new Date(), needsRecheck: false })
    const { outcome, status } = await this.mobileIdService.status(pending.requestId)
    await this.authCodes.update(key, { providerStatus: status })

    if (outcome === 'confirmed') {
      return this.confirmPhone(identifier)
    }
    if (outcome === 'failed') {
      this.logger.warn(`Заявка ${pending.requestId}: аутентификация не пройдена (статус ${status})`)
      return { status: 'failed' }
    }
    return { status: outcome === 'needs-code' ? 'needs-code' : 'pending' }
  }

  /**
   * Проверяет код. У телефона его выпустил и проверяет провайдер, у почты код
   * наш и сверяется здесь.
   */
  async verifyCode(login: string, code: string): Promise<{ accessToken: string; user: User }> {
    const kind = detectLoginKind(login)
    const identifier = kind === 'email' ? normalizeEmail(login) : login
    const codeKind: AuthCodeKind = kind === 'email' ? 'email-login' : 'phone'

    await this.consumeAttempt(identifier, codeKind, code)

    const user =
      kind === 'email'
        ? await this.usersService.getOrCreateByEmail(identifier)
        : await this.usersService.getOrCreateByPhone(identifier)

    await this.authCodes.delete({ identifier, kind: codeKind })
    return this.issueToken(user)
  }

  /**
   * Отправляет код подтверждения почты уже вошедшему человеку. Нужен потому,
   * что отзыв подписывается почтой: на неё уходит решение модератора.
   *
   * Занятость проверяем до отправки — иначе человек получил бы письмо ради
   * кода, который всё равно упрётся в 409.
   */
  async requestEmailAttach(userId: string, email: string): Promise<void> {
    const identifier = normalizeEmail(email)

    const owner = await this.usersService.findByEmail(identifier)
    if (owner && owner.id !== userId) {
      throw new ConflictException('Эта почта уже используется другим аккаунтом')
    }

    await this.assertNotThrottled(identifier, 'email-attach')

    const code = generateCode()
    await this.mailService.send(
      identifier,
      'Подтверждение почты на Квартирнике',
      `Ваш код подтверждения: ${code}\n\nКод действует пять минут. На эту почту мы пришлём решение модератора по вашему отзыву.`,
    )
    await this.saveAttempt({ identifier, kind: 'email-attach', sessionId: '', code })
  }

  /** Подтверждает почту и привязывает её к аккаунту */
  async verifyEmailAttach(userId: string, email: string, code: string): Promise<User> {
    const identifier = normalizeEmail(email)
    await this.consumeAttempt(identifier, 'email-attach', code)

    // Между отправкой кода и вводом почту мог занять кто-то ещё
    const owner = await this.usersService.findByEmail(identifier)
    if (owner && owner.id !== userId) {
      throw new ConflictException('Эта почта уже используется другим аккаунтом')
    }

    const user = await this.usersService.setEmail(userId, identifier)
    await this.authCodes.delete({ identifier, kind: 'email-attach' })
    return user
  }

  /**
   * Отмечает заявку как требующую перепроверки. Вызывается приёмником webhook,
   * который сам по себе ничего не решает: тело приходит без подписи, поэтому
   * статус мы всё равно спрашиваем у провайдера.
   *
   * Секрет из адреса сверяем здесь же — по нему и находится заявка.
   */
  async markForRecheck(sessionId: string, requestId: string): Promise<boolean> {
    const pending = await this.authCodes.findOneBy({ pollSecret: sessionId, kind: 'phone' })
    if (!pending || pending.requestId !== requestId) {
      return false
    }
    await this.authCodes.update(
      { identifier: pending.identifier, kind: pending.kind },
      { needsRecheck: true },
    )
    return true
  }

  /** Пауза между запросами на один идентификатор; общая для всех способов */
  private async assertNotThrottled(identifier: string, kind: AuthCodeKind): Promise<void> {
    // Просроченные попытки не нужны никому. Строка живёт, пока не истекло хотя бы одно
    // из двух: сама попытка или пауза — иначе исчерпанные попытки обнуляли бы паузу
    // и следующую (платную) авторизацию можно было бы вызвать сразу.
    const now = new Date()
    await this.authCodes.delete({ expiresAt: LessThan(now), nextRequestAt: LessThan(now) })

    const pending = await this.authCodes.findOneBy({ identifier, kind })
    if (pending && pending.nextRequestAt > now) {
      const seconds = Math.ceil((pending.nextRequestAt.getTime() - now.getTime()) / 1000)
      // Отдельного TooManyRequestsException в Nest нет
      throw new HttpException(
        `Код уже запрошен, повторите через ${seconds} с`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  /** upsert, а не save: двойной клик иначе гонялся бы между select и insert */
  private saveAttempt(attempt: {
    identifier: string
    kind: AuthCodeKind
    sessionId: string
    code?: string
    requestId?: string
    providerStatus?: number
  }): Promise<unknown> {
    const startedAt = Date.now()
    return this.authCodes.upsert(
      {
        identifier: attempt.identifier,
        kind: attempt.kind,
        code: attempt.code ?? null,
        requestId: attempt.requestId ?? null,
        providerStatus: attempt.providerStatus ?? 0,
        needsRecheck: false,
        pollSecret: attempt.sessionId,
        lastPollAt: null,
        expiresAt: new Date(startedAt + CODE_TTL_MS),
        nextRequestAt: new Date(startedAt + REQUEST_INTERVAL_MS),
        attempts: 0,
      },
      ['identifier', 'kind'],
    )
  }

  /**
   * Проверяет код и считает неудачные попытки. Возвращает попытку, но не удаляет
   * её: удаление — дело вызывающего, после того как он довёл дело до конца.
   */
  private async consumeAttempt(
    identifier: string,
    kind: AuthCodeKind,
    code: string,
  ): Promise<AuthCode> {
    const pending = await this.authCodes.findOneBy({ identifier, kind })
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException('Неверный или истёкший код')
    }

    const isValid =
      kind === 'phone'
        ? await this.mobileIdService.verify(pending.requestId ?? '', code)
        : pending.code === code

    if (isValid) {
      return pending
    }

    // Код перебирается, поэтому попытки считаем и на пределе заявку гасим.
    // Текст ошибки общий: разные сообщения подсказывали бы боту, что адрес угадан.
    const attempts = pending.attempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      // Гасим попытку сроком, а не удалением строки: пауза до следующей
      // авторизации должна пережить исчерпанные попытки, иначе перебор
      // и оплачивал бы сам себя
      await this.authCodes.update({ identifier, kind }, { attempts, expiresAt: new Date() })
      throw new UnauthorizedException('Слишком много попыток, запросите новый код')
    }
    await this.authCodes.update({ identifier, kind }, { attempts })
    throw new UnauthorizedException('Неверный или истёкший код')
  }

  /** Подтверждённая телефонная заявка превращается в токен */
  private async confirmPhone(phone: string): Promise<SessionResult> {
    await this.authCodes.delete({ identifier: phone, kind: 'phone' })
    const user = await this.usersService.getOrCreateByPhone(phone)
    const session = await this.issueToken(user)
    return { status: 'confirmed', ...session }
  }

  /** Общий финал входа: пользователь получает токен */
  private async issueToken(user: User): Promise<{ accessToken: string; user: User }> {
    const payload: JwtPayload = { sub: user.id }
    const accessToken = await this.jwtService.signAsync(payload)
    return { accessToken, user }
  }
}
