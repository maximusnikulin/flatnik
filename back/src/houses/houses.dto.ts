import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class HousesByAddressQueryDto {
  /** Канонический адрес, как его вернул геокодер */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string
}

export class HousePinDto {
  /** Идентификатор дома */
  id!: string

  /** Отображаемый адрес */
  address!: string

  lat!: number

  lon!: number

  /** Подтверждённых отзывов по всем квартирам дома; других публично не существует */
  confirmedCount!: number
}

export class ApartmentSummaryDto {
  /** Идентификатор квартиры */
  id!: string

  /** Номер квартиры */
  number!: string

  /** Подъезд */
  entrance!: string

  /** Подтверждённых отзывов */
  confirmedCount!: number
}

/** Части публичного URL дома: /{citySlug}/{streetSlug}/{houseSlug} */
export class HouseSlugsDto {
  @ApiProperty({ example: 'moskva' })
  citySlug!: string

  @ApiProperty({ example: 'tverskaya-ulica' })
  streetSlug!: string

  @ApiProperty({ example: '12' })
  houseSlug!: string
}

/** Источник слагов: строка дома из базы или результат разбора адреса */
interface SlugSource {
  citySlug: string | null
  streetSlug: string | null
  houseSlug: string | null
}

/** Слаги отдаются наружу только полным набором: из неполного URL не собрать */
export function toHouseSlugsDto(source: SlugSource | null): HouseSlugsDto | null {
  if (!source?.citySlug || !source.streetSlug || !source.houseSlug) {
    return null
  }
  return {
    citySlug: source.citySlug,
    streetSlug: source.streetSlug,
    houseSlug: source.houseSlug,
  }
}

export class HouseWithApartmentsDto {
  id!: string

  address!: string

  lat!: number

  lon!: number

  /** Части URL публичной страницы; null — адрес дома не разобрался на город и улицу */
  @ApiProperty({ type: HouseSlugsDto, nullable: true })
  slug!: HouseSlugsDto | null

  /** Квартиры дома, по которым есть подтверждённые отзывы */
  @ApiProperty({ type: ApartmentSummaryDto, isArray: true })
  apartments!: ApartmentSummaryDto[]
}

export class HouseLookupResponseDto {
  /** null — по этому адресу ещё нет ни одного отзыва */
  @ApiProperty({ type: HouseWithApartmentsDto, nullable: true })
  house!: HouseWithApartmentsDto | null

  /**
   * Слаги для ссылки на страницу дома. Считаются и когда дома ещё нет в базе:
   * фронт не должен повторять транслитерацию, иначе его вариант разойдётся с
   * сохранённым — например, когда номер получил суффикс из-за коллизии.
   */
  @ApiProperty({ type: HouseSlugsDto, nullable: true })
  slug!: HouseSlugsDto | null
}
