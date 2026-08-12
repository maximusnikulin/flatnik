import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, Matches } from 'class-validator'

/** Убирает пробелы, скобки и дефисы, приводит 8XXX/7XXX к +7XXX */
function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const digits = value.replace(/[\s()-]/g, '')
  if (/^8\d{10}$/.test(digits)) return `+7${digits.slice(1)}`
  if (/^7\d{10}$/.test(digits)) return `+${digits}`
  return digits
}

/**
 * Только телефон. Наследники расходятся, а не выстраиваются в цепочку:
 * капча нужна на выдаче кода и не нужна на его проверке, а при
 * `VerifyCodeDto extends RequestCodeDto` токен утёк бы и в verify-code.
 */
class PhoneDto {
  /** Телефон в российском формате */
  @ApiProperty({ example: '+79991234567' })
  @Transform(({ value }) => normalizePhone(value))
  @Matches(/^\+7\d{10}$/, { message: 'Ожидается телефон в формате +7XXXXXXXXXX' })
  phone!: string
}

export class RequestCodeDto extends PhoneDto {
  /** Токен SmartCaptcha; обязателен, когда проверка капчи включена */
  @IsOptional()
  @IsString()
  captchaToken?: string
}

export class VerifyCodeDto extends PhoneDto {
  /** Шестизначный код из лога бэкенда */
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Код — шесть цифр' })
  code!: string
}

export class UserDto {
  /** Идентификатор пользователя */
  id!: string

  /** Телефон, на который выдан токен */
  @ApiProperty({ example: '+79991234567' })
  phone!: string

  /** Имя из формы отзыва; null, пока не указано */
  @ApiProperty({ type: String, nullable: true, example: 'Максим' })
  name!: string | null
}

export class AuthResponseDto {
  /** Bearer-токен для заголовка Authorization */
  accessToken!: string

  /** Профиль вошедшего пользователя */
  user!: UserDto
}
