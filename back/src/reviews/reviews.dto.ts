import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ReviewStatus } from './review-status'

/** Обрезает пробелы по краям строковых полей формы */
function trimmed({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

export class CreateReviewDto {
  /** Канонический адрес дома от геокодера */
  @Transform(trimmed)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address!: string

  /** Широта дома */
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  /** Долгота дома */
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number

  /** Номер квартиры */
  @ApiProperty({ example: '120' })
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  apartmentNumber!: string

  /** Подъезд; обязателен — API Яндекса его не отдаёт, вводится вручную */
  @ApiProperty({ example: '7' })
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  entrance!: string

  /** Кадастровый номер из выписки ЕГРН */
  @ApiProperty({ example: '77:01:0001075:1234' })
  @Transform(trimmed)
  @Matches(/^[\d:]{5,40}$/, { message: 'Кадастровый номер — цифры и двоеточия' })
  egrn!: string

  /** Текст отзыва */
  @Transform(trimmed)
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  text!: string

  /** Начало периода съёма, ISO-дата */
  @ApiProperty({ required: false, example: '2024-03-12' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  periodFrom?: string

  /** Конец периода съёма, ISO-дата */
  @ApiProperty({ required: false, example: '2025-04-12' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  periodTo?: string

  /** Токен SmartCaptcha; обязателен, когда проверка капчи включена */
  @IsOptional()
  @IsString()
  captchaToken?: string
}

export class ReviewDto {
  /** Идентификатор отзыва */
  id!: string

  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  /** Никнейм автора */
  authorName!: string

  /** Текст отзыва */
  text!: string

  /** Начало периода съёма */
  @ApiProperty({ type: String, nullable: true, example: '2024-03-12' })
  periodFrom!: string | null

  /** Конец периода съёма */
  @ApiProperty({ type: String, nullable: true, example: '2025-04-12' })
  periodTo!: string | null

  /** Дата создания, ISO 8601 */
  createdAt!: string
}

/** Свой отзыв в личном списке: автор известен, зато нужен адрес квартиры */
export class MyReviewDto {
  /** Идентификатор отзыва */
  id!: string

  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  /** Текст отзыва */
  text!: string

  /** Начало периода съёма */
  @ApiProperty({ type: String, nullable: true, example: '2024-03-12' })
  periodFrom!: string | null

  /** Конец периода съёма */
  @ApiProperty({ type: String, nullable: true, example: '2025-04-12' })
  periodTo!: string | null

  /** Дата создания, ISO 8601 */
  createdAt!: string

  /** Дата последней правки, ISO 8601; по ней отсортирован список */
  updatedAt!: string

  /** Идентификатор квартиры, о которой отзыв */
  apartmentId!: string

  /** Номер квартиры */
  @ApiProperty({ example: '120' })
  apartmentNumber!: string

  /** Подъезд */
  @ApiProperty({ example: '7' })
  entrance!: string

  /** Адрес дома */
  address!: string

  /** Широта дома — к этой точке перелетает карта */
  lat!: number

  /** Долгота дома */
  lon!: number
}

export class ReviewCreatedDto {
  reviewId!: string

  houseId!: string

  apartmentId!: string

  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus
}
