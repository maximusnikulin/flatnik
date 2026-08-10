import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ReviewsService } from './reviews.service'
import { ReviewDto } from './reviews.dto'

@ApiTags('reviews')
@Controller('apartments')
export class ApartmentReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Отзывы одной квартиры, новые сверху */
  @Get(':id/reviews')
  @ApiOkResponse({ type: ReviewDto, isArray: true })
  list(@Param('id', ParseUUIDPipe) id: string): Promise<ReviewDto[]> {
    return this.reviewsService.listByApartment(id)
  }
}
