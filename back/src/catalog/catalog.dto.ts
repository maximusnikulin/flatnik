import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'
import { ReviewStatus } from '../reviews/review-status'
import type { TrustLevel } from '../reviews/review-trust'

/** Постраничная выборка списков каталога */
export class PageQueryDto {
  /** Номер страницы, с единицы */
  @ApiProperty({ required: false, type: 'integer', minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number
}

/** Город в списке городов */
export class CityListItemDto {
  @ApiProperty({ example: 'moskva' })
  citySlug!: string

  @ApiProperty({ example: 'Москва' })
  cityName!: string

  /** Домов с подтверждёнными отзывами */
  houseCount!: number

  /** Подтверждённых отзывов по всему городу */
  reviewCount!: number
}

/** Улица в списке улиц города */
export class StreetListItemDto {
  @ApiProperty({ example: 'tverskaya-ulica' })
  streetSlug!: string

  @ApiProperty({ example: 'Тверская улица' })
  streetName!: string

  houseCount!: number

  reviewCount!: number

  /** Средняя оценка по улице, округлённая до десятых; null — ни одной оценки */
  @ApiProperty({ type: Number, nullable: true, example: 4.3 })
  ratingAvg!: number | null
}

/** Дом в списке домов улицы */
export class StreetHouseDto {
  id!: string

  @ApiProperty({ example: '12' })
  houseSlug!: string

  /** Номер дома как в адресе: «12с17» */
  @ApiProperty({ example: '12с17' })
  houseNumber!: string

  address!: string

  reviewCount!: number

  @ApiProperty({ type: Number, nullable: true, example: 4.3 })
  ratingAvg!: number | null
}

/** Квартира на странице дома */
export class HouseApartmentDto {
  id!: string

  @ApiProperty({ example: '120' })
  number!: string

  @ApiProperty({ example: '7' })
  entrance!: string

  reviewCount!: number

  @ApiProperty({ type: Number, nullable: true, example: 4.3 })
  ratingAvg!: number | null
}

/**
 * Отзыв на странице дома. Повторяет ReviewDto и добавляет квартиру: страница
 * показывает отзывы всего дома, поэтому без номера квартиры они неразличимы.
 * Отдельным классом, а не наследником, — чтобы каталог не зависел от DTO отзывов.
 */
export class HouseReviewDto {
  id!: string

  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  /** Никнейм автора */
  authorName!: string

  text!: string

  @ApiProperty({ type: Number, nullable: true, example: 4 })
  rating!: number | null

  @ApiProperty({ type: String, nullable: true, example: '2024-03' })
  periodFrom!: string | null

  @ApiProperty({ type: String, nullable: true, example: '2025-04' })
  periodTo!: string | null

  /**
   * Уровень доверия: high — предоставлена запись регистрации права,
   * low — запись не указана или указан только кадастровый номер.
   */
  @ApiProperty({ enum: ['high', 'low'] })
  trustLevel!: TrustLevel

  /** Дата создания, ISO 8601 */
  createdAt!: string

  apartmentId!: string

  @ApiProperty({ example: '120' })
  apartmentNumber!: string

  @ApiProperty({ example: '7' })
  entrance!: string
}

/** Хлебные крошки и заголовки страницы города */
export class CityPageDto {
  @ApiProperty({ example: 'moskva' })
  citySlug!: string

  @ApiProperty({ example: 'Москва' })
  cityName!: string

  houseCount!: number

  reviewCount!: number

  @ApiProperty({ type: StreetListItemDto, isArray: true })
  streets!: StreetListItemDto[]

  /** Всего улиц в городе: по нему считается число страниц */
  streetCount!: number
}

export class StreetPageDto {
  @ApiProperty({ example: 'moskva' })
  citySlug!: string

  @ApiProperty({ example: 'Москва' })
  cityName!: string

  @ApiProperty({ example: 'tverskaya-ulica' })
  streetSlug!: string

  @ApiProperty({ example: 'Тверская улица' })
  streetName!: string

  reviewCount!: number

  @ApiProperty({ type: Number, nullable: true, example: 4.3 })
  ratingAvg!: number | null

  @ApiProperty({ type: StreetHouseDto, isArray: true })
  houses!: StreetHouseDto[]

  /** Всего домов на улице */
  houseCount!: number
}

export class HousePageDto {
  id!: string

  /** Полный адрес от геокодера */
  address!: string

  @ApiProperty({ example: 'moskva' })
  citySlug!: string

  @ApiProperty({ example: 'Москва' })
  cityName!: string

  @ApiProperty({ example: 'tverskaya-ulica' })
  streetSlug!: string

  @ApiProperty({ example: 'Тверская улица' })
  streetName!: string

  @ApiProperty({ example: '12' })
  houseSlug!: string

  @ApiProperty({ example: '12с17' })
  houseNumber!: string

  lat!: number

  lon!: number

  /** Подтверждённых отзывов по всему дому */
  reviewCount!: number

  /** Средняя оценка, округлённая до десятых; null — ни у одного отзыва нет оценки */
  @ApiProperty({ type: Number, nullable: true, example: 4.3 })
  ratingAvg!: number | null

  /** Отзывов с оценкой; в разметке это reviewCount у aggregateRating */
  ratingCount!: number

  /** Дата последнего изменения отзывов, ISO 8601; из неё берётся lastmod в sitemap */
  @ApiProperty({ type: String, nullable: true })
  updatedAt!: string | null

  @ApiProperty({ type: HouseApartmentDto, isArray: true })
  apartments!: HouseApartmentDto[]

  @ApiProperty({ type: HouseReviewDto, isArray: true })
  reviews!: HouseReviewDto[]
}
