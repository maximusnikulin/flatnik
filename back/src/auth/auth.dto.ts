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
  /** Телефон в российском формате; номера других стран не обслуживаем */
  @ApiProperty({ example: '+79991234567' })
  @Transform(({ value }) => normalizePhone(value))
  @Matches(/^\+7\d{10}$/, { message: 'Принимаем только номера +7XXXXXXXXXX' })
  phone!: string
}

export class RequestCodeDto extends PhoneDto {
  /**
   * Токен SmartCaptcha. Опционален в схеме, потому что в разработке ключей может
   * не быть; когда серверный ключ задан, отсутствие токена даёт 400 в CaptchaService.
   */
  @IsOptional()
  @IsString()
  captchaToken?: string
}

export class VerifyCodeDto extends PhoneDto {
  /** Шестизначный код из SMS */
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Код — шесть цифр' })
  code!: string
}

export class SetNicknameDto {
  /**
   * Никнейм: буквы, цифры и подчёркивание, 3–20 символов. Пробелов нет
   * намеренно — ник подписывает отзывы и читается как идентификатор.
   * Занятость проверяется без учёта регистра.
   */
  // Регэксп инлайном, а не константой: CLI-плагин Swagger кладёт в схему
  // исходный текст аргумента и с константой записал бы туда её имя.
  @ApiProperty({ example: 'maxim_n', minLength: 3, maxLength: 20 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^[\p{L}\p{N}_]{3,20}$/u, {
    message: 'Ник — от 3 до 20 символов: буквы, цифры и подчёркивание',
  })
  nickname!: string
}

export class UserDto {
  /** Идентификатор пользователя */
  id!: string

  /** Телефон, на который выдан токен */
  @ApiProperty({ example: '+79991234567' })
  phone!: string

  /** Публичный ник; им подписаны отзывы */
  @ApiProperty({ example: 'maxim_n' })
  nickname!: string

  /**
   * false — ник сгенерирован автоматически и пользователь его ещё не выбирал.
   * Фронт по этому флагу показывает обязательный шаг ввода ника.
   */
  nicknameConfirmed!: boolean
}

export class AuthResponseDto {
  /** Bearer-токен для заголовка Authorization */
  accessToken!: string

  /** Профиль вошедшего пользователя */
  user!: UserDto
}
