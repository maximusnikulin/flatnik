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

  /** Подтверждённых отзывов по всем квартирам дома */
  confirmedCount!: number

  /** Неподтверждённых отзывов по всем квартирам дома */
  pendingCount!: number
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

  /** Неподтверждённых отзывов */
  pendingCount!: number
}

export class HouseWithApartmentsDto {
  id!: string

  address!: string

  lat!: number

  lon!: number

  /** Квартиры дома, по которым есть отзывы */
  @ApiProperty({ type: ApartmentSummaryDto, isArray: true })
  apartments!: ApartmentSummaryDto[]
}

export class HouseLookupResponseDto {
  /** null — по этому адресу ещё нет ни одного отзыва */
  @ApiProperty({ type: HouseWithApartmentsDto, nullable: true })
  house!: HouseWithApartmentsDto | null
}
