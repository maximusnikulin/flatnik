import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUserId } from './current-user-id.decorator'
import {
  AuthResponseDto,
  RequestCodeDto,
  RequestCodeResponseDto,
  SessionPollDto,
  SessionStatusDto,
  SetNicknameDto,
  UserDto,
  VerifyCodeDto,
} from './auth.dto'
import type { User } from '../users/user.entity'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Начать вход: мобильная авторизация на указанный номер. Дальше человек либо
   * подтверждает вход на SIM-карте, либо получает от провайдера код в SMS —
   * что именно, говорит опрос статуса (`session`), а не этот ответ.
   */
  @Post('request-code')
  @HttpCode(200)
  @ApiOkResponse({ type: RequestCodeResponseDto })
  @ApiForbiddenResponse({ description: 'Не пройдена проверка капчи' })
  @ApiTooManyRequestsResponse({ description: 'Вход по этому номеру запрошен меньше минуты назад' })
  @ApiServiceUnavailableResponse({ description: 'Провайдер недоступен — войти сейчас нельзя' })
  requestCode(@Body() dto: RequestCodeDto, @Req() request: Request): Promise<RequestCodeResponseDto> {
    return this.authService.requestCode(dto.phone, dto.captchaToken, request.ip)
  }

  /**
   * Узнать, чем кончилась заявка. Фронт опрашивает этот метод, пока идёт
   * мобильная авторизация; при подтверждении в ответе сразу токен.
   *
   * POST, а не GET: телефон и секрет сессии в query-строке осели бы в логах nginx.
   */
  @Post('session')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionStatusDto })
  async pollSession(@Body() dto: SessionPollDto): Promise<SessionStatusDto> {
    const result = await this.authService.pollSession(dto.phone, dto.sessionId)
    if (result.status !== 'confirmed') {
      return { status: result.status }
    }
    return {
      status: 'confirmed',
      accessToken: result.accessToken,
      user: this.toUserDto(result.user),
    }
  }

  /**
   * Приёмник статусов мобильной авторизации.
   *
   * Тело приходит без подписи, поэтому решения по нему не принимаются: приёмник
   * только помечает заявку как требующую перепроверки, а статус всё равно
   * спрашивается у провайдера в `session`. Иначе тот, кто подберёт id заявки,
   * прислал бы «status: 1» и получил чужой вход.
   *
   * Секрет заявки в адресе — он же `sessionId`, выданный тому, кто вход начал:
   * без него приёмник даже не ищет заявку.
   */
  @Post('mobile-id/callback/:secret')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Уведомление принято' })
  async mobileIdCallback(
    @Param('secret') secret: string,
    @Body() body: Record<string, unknown>,
  ): Promise<void> {
    // Целиком тело не пишем: в нём может приехать код, отправленный человеку
    const requestId = String(body?.id ?? '')
    const matched = await this.authService.markForRecheck(secret, requestId)
    this.logger.log(
      `Уведомление мобильной авторизации: заявка ${requestId}, статус ${String(body?.status)}` +
        (matched ? '' : ' — заявка не найдена'),
    )
    // Провайдер ждёт 200 и повторяет сутки, если его не получил. Неизвестная
    // заявка — не повод заставлять его повторять: ошибка не на его стороне.
  }

  /** Обменять код из сообщения на JWT */
  @Post('verify-code')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Неверный, истёкший код или исчерпаны попытки' })
  async verifyCode(@Body() dto: VerifyCodeDto): Promise<AuthResponseDto> {
    const { accessToken, user } = await this.authService.verifyCode(dto.phone, dto.code)
    return { accessToken, user: this.toUserDto(user) }
  }

  /** Профиль текущего пользователя */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserDto })
  async me(@CurrentUserId() userId: string): Promise<UserDto> {
    const user = await this.usersService.findById(userId)
    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }
    return this.toUserDto(user)
  }

  /**
   * Принять пользовательское соглашение и дать согласие на обработку
   * персональных данных. Одно действие на оба документа: согласие в
   * интерфейсе одно и покрывает их вместе.
   *
   * Идемпотентен: повторный вызов не сдвигает дату принятия.
   */
  @Post('me/consent')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserDto })
  async acceptConsent(@CurrentUserId() userId: string): Promise<UserDto> {
    const user = await this.usersService.acceptConsent(userId)
    return this.toUserDto(user)
  }

  /** Выбрать никнейм; он же подтверждает автоматически выданный при регистрации */
  @Patch('me/nickname')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Никнейм уже занят' })
  async setNickname(
    @CurrentUserId() userId: string,
    @Body() dto: SetNicknameDto,
  ): Promise<UserDto> {
    const user = await this.usersService.setNickname(userId, dto.nickname)
    return this.toUserDto(user)
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      nicknameConfirmed: user.nicknameConfirmed,
      consentAccepted: user.consentAcceptedAt !== null,
    }
  }
}
