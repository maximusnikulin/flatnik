import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUserId } from '../auth/current-user-id.decorator'
import { ReviewsService } from './reviews.service'
import { CreateReviewDto, MyReviewDto, ReviewCreatedDto } from './reviews.dto'

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Свои отзывы с адресами квартир, недавно изменённые сверху */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MyReviewDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Нет или истёк токен авторизации' })
  listMine(@CurrentUserId() userId: string): Promise<MyReviewDto[]> {
    return this.reviewsService.listMine(userId)
  }

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
