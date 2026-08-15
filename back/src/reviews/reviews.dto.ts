import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { HouseSlugsDto } from '../houses/houses.dto'
import { ReviewStatus } from './review-status'

/** Потолок длины отзыва: столько же стоит в textarea формы */
const TEXT_MAX_LENGTH = 500

/**
 * Период съёма задаётся месяцем и годом — день жильцы всё равно не помнят.
 *
 * В контракт выражение попадает через `pattern` в @ApiProperty: его значение
 * вычисляется в рантайме. Разбирать @Matches плагину Swagger нельзя — он читает
 * аргумент синтаксически и положил бы в схему имя константы.
 */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

const MONTH_MESSAGE = 'Месяц в формате ГГГГ-ММ'

/** Границы оценки; те же числа задают шкалу звёзд в форме */
const RATING_MIN = 1
const RATING_MAX = 5

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

  /**
   * Кадастровый номер из выписки ЕГРН: округ:район:квартал:объект.
   * Квартал — шесть или семь цифр, номер объекта — от одной.
   * Тот же формат задаёт маска поля на фронте.
   */
  @ApiProperty({ example: '77:01:0001075:1234' })
  @Transform(trimmed)
  @Matches(/^\d{2}:\d{2}:\d{6,7}:\d{1,10}$/, {
    message: 'Кадастровый номер — в формате 77:01:0001075:1234',
  })
  egrn!: string

  /** Текст отзыва */
  @Transform(trimmed)
  @IsString()
  @MinLength(10)
  @MaxLength(TEXT_MAX_LENGTH)
  text!: string

  /** Оценка квартиры от 1 до 5 */
  @ApiProperty({ type: 'integer', example: 4, minimum: RATING_MIN, maximum: RATING_MAX })
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating!: number

  /** Начало периода съёма, месяц и год */
  @ApiProperty({ required: false, example: '2024-03', pattern: MONTH_PATTERN.source })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
  periodFrom?: string

  /** Конец периода съёма, месяц и год */
  @ApiProperty({ required: false, example: '2025-04', pattern: MONTH_PATTERN.source })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
  periodTo?: string

  /** Токен SmartCaptcha; обязателен, когда проверка капчи включена */
  @IsOptional()
  @IsString()
  captchaToken?: string
}

/** Правка своего отзыва: квартира и ЕГРН не меняются — это был бы другой отзыв */
export class UpdateReviewDto {
  /** Текст отзыва */
  @Transform(trimmed)
  @IsString()
  @MinLength(10)
  @MaxLength(TEXT_MAX_LENGTH)
  text!: string

  /** Оценка квартиры от 1 до 5 */
  @ApiProperty({ type: 'integer', example: 4, minimum: RATING_MIN, maximum: RATING_MAX })
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating!: number

  /** Начало периода съёма, месяц и год */
  @ApiProperty({ required: false, example: '2024-03', pattern: MONTH_PATTERN.source })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
  periodFrom?: string

  /** Конец периода съёма, месяц и год */
  @ApiProperty({ required: false, example: '2025-04', pattern: MONTH_PATTERN.source })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
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

  /** Оценка от 1 до 5; null — отзыв написан до появления рейтинга */
  @ApiProperty({ type: Number, nullable: true, example: 4 })
  rating!: number | null

  /** Начало периода съёма, месяц и год */
  @ApiProperty({ type: String, nullable: true, example: '2024-03' })
  periodFrom!: string | null

  /** Конец периода съёма, месяц и год */
  @ApiProperty({ type: String, nullable: true, example: '2025-04' })
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

  /** Оценка от 1 до 5; null — отзыв написан до появления рейтинга */
  @ApiProperty({ type: Number, nullable: true, example: 4 })
  rating!: number | null

  /** Начало периода съёма, месяц и год */
  @ApiProperty({ type: String, nullable: true, example: '2024-03' })
  periodFrom!: string | null

  /** Конец периода съёма, месяц и год */
  @ApiProperty({ type: String, nullable: true, example: '2025-04' })
  periodTo!: string | null

  /** Причина отклонения от модератора; null — отзыв не отклоняли */
  @ApiProperty({ type: String, nullable: true })
  rejectionReason!: string | null

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

  /** Части URL публичной страницы дома; null — адрес не разобрался */
  @ApiProperty({ type: HouseSlugsDto, nullable: true })
  slug!: HouseSlugsDto | null

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
