import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { CatalogService } from './catalog.service'
import {
  CityListItemDto,
  CityPageDto,
  HousePageDto,
  PageQueryDto,
  StreetPageDto,
} from './catalog.dto'

/**
 * Каталог отзывов: город → улица → дом. Те же данные показывает клиент при
 * навигации и бэкенд при серверном рендере, поэтому это обычный API под /api,
 * а не часть SEO-модуля.
 */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /** Города, где есть подтверждённые отзывы */
  @Get('cities')
  @ApiOkResponse({ type: CityListItemDto, isArray: true })
  cities(): Promise<CityListItemDto[]> {
    return this.catalogService.listCities()
  }

  /** Улицы города */
  @Get('cities/:citySlug')
  @ApiOkResponse({ type: CityPageDto })
  async city(
    @Param('citySlug') citySlug: string,
    @Query() query: PageQueryDto,
  ): Promise<CityPageDto> {
    const city = await this.catalogService.findCity(citySlug, query.page ?? 1)
    if (!city) {
      throw new NotFoundException('Город не найден')
    }
    return city
  }

  /** Дома улицы */
  @Get('cities/:citySlug/streets/:streetSlug')
  @ApiOkResponse({ type: StreetPageDto })
  async street(
    @Param('citySlug') citySlug: string,
    @Param('streetSlug') streetSlug: string,
    @Query() query: PageQueryDto,
  ): Promise<StreetPageDto> {
    const street = await this.catalogService.findStreet(citySlug, streetSlug, query.page ?? 1)
    if (!street) {
      throw new NotFoundException('Улица не найдена')
    }
    return street
  }

  /** Дом со всеми подтверждёнными отзывами */
  @Get('cities/:citySlug/streets/:streetSlug/houses/:houseSlug')
  @ApiOkResponse({ type: HousePageDto })
  async house(
    @Param('citySlug') citySlug: string,
    @Param('streetSlug') streetSlug: string,
    @Param('houseSlug') houseSlug: string,
  ): Promise<HousePageDto> {
    const house = await this.catalogService.findHouse(citySlug, streetSlug, houseSlug)
    if (!house) {
      throw new NotFoundException('Дом не найден')
    }
    return house
  }
}
