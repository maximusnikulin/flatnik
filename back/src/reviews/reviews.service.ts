import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { HousesService } from '../houses/houses.service'
import { ModerationService } from './moderation.service'
import { Review } from './review.entity'
import { ReviewStatus } from './review-status'
import type {
  CreateReviewDto,
  MyReviewDto,
  ReviewCreatedDto,
  ReviewDto,
  UpdateReviewDto,
} from './reviews.dto'

/**
 * Период съёма приходит месяцем («2024-03»), а колонки в БД — `date`. Кладём
 * первое число месяца: тип остаётся датой, сравнения и сортировки работают.
 */
function toStoredDate(month: string | undefined): string | null {
  return month ? `${month}-01` : null
}

/** Обратное преобразование: из даты в БД наружу отдаём только месяц и год */
function toMonth(stored: string | null): string | null {
  return stored ? stored.slice(0, 7) : null
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly dataSource: DataSource,
    private readonly captchaService: CaptchaService,
    private readonly housesService: HousesService,
    private readonly moderationService: ModerationService,
  ) {}

  /** Создаёт отзыв, заводя дом и квартиру при необходимости */
  async create(userId: string, dto: CreateReviewDto, ip?: string): Promise<ReviewCreatedDto> {
    if (dto.periodFrom && dto.periodTo && dto.periodFrom > dto.periodTo) {
      throw new BadRequestException('Начало периода съёма позже его конца')
    }

    // Сетевой вызов — до транзакции, чтобы не держать соединение с БД
    await this.captchaService.validate(dto.captchaToken, ip)

    const created = await this.dataSource.transaction(async (em) => {
      const house = await this.housesService.getOrCreateHouse(em, {
        address: dto.address,
        lat: dto.lat,
        lon: dto.lon,
      })
      const apartment = await this.housesService.getOrCreateApartment(em, {
        houseId: house.id,
        number: dto.apartmentNumber,
        entrance: dto.entrance,
      })

      const review = await em.save(
        em.create(Review, {
          apartmentId: apartment.id,
          authorId: userId,
          egrn: dto.egrn,
          text: dto.text,
          rating: dto.rating,
          periodFrom: toStoredDate(dto.periodFrom),
          periodTo: toStoredDate(dto.periodTo),
          status: ReviewStatus.Pending,
          rejectionReason: null,
        }),
      )

      return {
        reviewId: review.id,
        houseId: house.id,
        apartmentId: apartment.id,
        status: review.status,
      }
    })

    // После коммита: модератор не должен получить карточку раньше, чем отзыв
    // станет виден, а сетевой вызов — держать соединение с БД
    await this.moderationService.notify(created.reviewId)

    return created
  }

  /**
   * Правит свой отзыв и отправляет его на повторную проверку. Квартира и ЕГРН
   * не меняются: другая квартира — это другой отзыв.
   */
  async update(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    ip?: string,
  ): Promise<MyReviewDto> {
    if (dto.periodFrom && dto.periodTo && dto.periodFrom > dto.periodTo) {
      throw new BadRequestException('Начало периода съёма позже его конца')
    }

    const review = await this.reviews.findOne({
      where: { id: reviewId, authorId: userId },
      relations: { apartment: { house: true } },
    })
    // Чужой отзыв не подтверждаем даже статусом ответа
    if (!review) {
      throw new NotFoundException('Отзыв не найден')
    }
    if (review.status === ReviewStatus.Pending) {
      throw new ConflictException('Отзыв на проверке — дождитесь решения модератора')
    }

    await this.captchaService.validate(dto.captchaToken, ip)

    review.text = dto.text
    review.rating = dto.rating
    review.periodFrom = toStoredDate(dto.periodFrom)
    review.periodTo = toStoredDate(dto.periodTo)
    review.status = ReviewStatus.Pending
    review.rejectionReason = null
    await this.reviews.save(review)

    await this.moderationService.notify(review.id, true)

    return this.toMyReview(review)
  }

  /**
   * Отзывы квартиры, новые сверху. Публично существуют только подтверждённые:
   * непроверенные и отклонённые видит один автор — в «Моих отзывах».
   */
  async listByApartment(apartmentId: string): Promise<ReviewDto[]> {
    const reviews = await this.reviews.find({
      where: { apartmentId, status: ReviewStatus.Confirmed },
      relations: { author: true },
      order: { createdAt: 'DESC' },
    })

    return reviews.map((review) => ({
      id: review.id,
      status: review.status,
      authorName: review.author.nickname,
      text: review.text,
      rating: review.rating,
      periodFrom: toMonth(review.periodFrom),
      periodTo: toMonth(review.periodTo),
      createdAt: review.createdAt.toISOString(),
    }))
  }

  /** Отзывы пользователя, недавно изменённые сверху */
  async listMine(userId: string): Promise<MyReviewDto[]> {
    const reviews = await this.reviews.find({
      where: { authorId: userId },
      relations: { apartment: { house: true } },
      order: { updatedAt: 'DESC' },
    })

    return reviews.map((review) => this.toMyReview(review))
  }

  /** Отзыв должен быть загружен с relations `apartment.house` */
  private toMyReview(review: Review): MyReviewDto {
    return {
      id: review.id,
      status: review.status,
      text: review.text,
      rating: review.rating,
      periodFrom: toMonth(review.periodFrom),
      periodTo: toMonth(review.periodTo),
      rejectionReason: review.rejectionReason,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      apartmentId: review.apartmentId,
      apartmentNumber: review.apartment.number,
      entrance: review.apartment.entrance,
      address: review.apartment.house.address,
      lat: review.apartment.house.lat,
      lon: review.apartment.house.lon,
    }
  }
}
