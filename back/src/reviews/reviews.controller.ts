import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUserId } from '../auth/current-user-id.decorator'
import { ReviewsService } from './reviews.service'
import { CreateReviewDto, MyReviewDto, ReviewCreatedDto, UpdateReviewDto } from './reviews.dto'

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

  /** Изменить свой отзыв; правка возвращает его на проверку модератору */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MyReviewDto })
  @ApiUnauthorizedResponse({ description: 'Нет или истёк токен авторизации' })
  @ApiForbiddenResponse({ description: 'Не пройдена проверка капчи' })
  @ApiNotFoundResponse({ description: 'Своего отзыва с таким идентификатором нет' })
  @ApiConflictResponse({ description: 'Отзыв на проверке у модератора' })
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
    @Req() request: Request,
  ): Promise<MyReviewDto> {
    return this.reviewsService.update(userId, id, dto, request.ip)
  }
}
