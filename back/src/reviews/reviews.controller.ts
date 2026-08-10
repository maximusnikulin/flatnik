import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUserId } from '../auth/current-user-id.decorator'
import { ReviewsService } from './reviews.service'
import { CreateReviewDto, ReviewCreatedDto } from './reviews.dto'

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Создать отзыв; дом и квартира заводятся автоматически */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ReviewCreatedDto })
  @ApiUnauthorizedResponse({ description: 'Нет или истёк токен авторизации' })
  @ApiForbiddenResponse({ description: 'Не пройдена проверка капчи' })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateReviewDto,
    @Req() request: Request,
  ): Promise<ReviewCreatedDto> {
    return this.reviewsService.create(userId, dto, request.ip)
  }
}
