import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
   * Начать вход: мобильная авторизация на указанный номер, а если она недоступна —
   * код в Telegram. Что показывать дальше, говорит ответ: `needsCode`.
   */
  @Post('request-code')
  @HttpCode(200)
  @ApiOkResponse({ type: RequestCodeResponseDto })
  @ApiForbiddenResponse({ description: 'Не пройдена проверка капчи' })
  @ApiTooManyRequestsResponse({ description: 'Вход по этому номеру запрошен меньше минуты назад' })
  @ApiServiceUnavailableResponse({ description: 'Провайдер недоступен' })
  requestCode(@Body() dto: RequestCodeDto, @Req() request: Request): Promise<RequestCodeResponseDto> {
    return this.authService.requestCode(dto.phone, dto.captchaToken, request.ip)
  }

  /**
   * Узнать, подтвердил ли человек вход на телефоне. Фронт опрашивает этот метод,
   * пока идёт мобильная авторизация; при подтверждении в ответе сразу токен.
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
   * Приёмник статусов мобильной авторизации. Решение принимает опрос статуса
   * (см. `session`), поэтому здесь только запись в лог: адрес обязателен в запросе
   * к провайдеру, и без эндпоинта он стучался бы в 404.
   */
  @Post('mobile-id/callback')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Уведомление принято' })
  mobileIdCallback(@Body() body: Record<string, unknown>): void {
    // Целиком тело не пишем: в нём может приехать код, отправленный человеку
    this.logger.log(
      `Уведомление мобильной авторизации: заявка ${String(body?.id)}, статус ${String(body?.status)}`,
    )
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
    }
  }
}
