import { Body, Controller, Get, HttpCode, NotFoundException, Post, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUserId } from './current-user-id.decorator'
import { AuthResponseDto, RequestCodeDto, UserDto, VerifyCodeDto } from './auth.dto'
import type { User } from '../users/user.entity'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /** Запросить код подтверждения; заглушка пишет код в лог бэкенда */
  @Post('request-code')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Код сгенерирован и записан в лог' })
  requestCode(@Body() dto: RequestCodeDto): void {
    this.authService.requestCode(dto.phone)
  }

  /** Обменять код из лога на JWT */
  @Post('verify-code')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Неверный или истёкший код' })
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

  private toUserDto(user: User): UserDto {
    return { id: user.id, phone: user.phone, name: user.name }
  }
}
