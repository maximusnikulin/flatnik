import { Controller, Get, Query } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { HousesService } from './houses.service'
import { HouseLookupResponseDto, HousePinDto, HousesByAddressQueryDto } from './houses.dto'

@ApiTags('houses')
@Controller('houses')
export class HousesController {
  constructor(private readonly housesService: HousesService) {}

  /** Все дома с отзывами — пины на карте */
  @Get()
  @ApiOkResponse({ type: HousePinDto, isArray: true })
  list(): Promise<HousePinDto[]> {
    return this.housesService.findPins()
  }

  /** Дом с квартирами по адресу; house = null, если отзывов ещё нет */
  @Get('by-address')
  @ApiOkResponse({ type: HouseLookupResponseDto })
  byAddress(@Query() query: HousesByAddressQueryDto): Promise<HouseLookupResponseDto> {
    return this.housesService.findByAddress(query.address)
  }
}
