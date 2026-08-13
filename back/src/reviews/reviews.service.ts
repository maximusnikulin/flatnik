import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { HousesService } from '../houses/houses.service'
import { Review } from './review.entity'
import { ReviewStatus } from './review-status'
import type { CreateReviewDto, ReviewCreatedDto, ReviewDto } from './reviews.dto'

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly dataSource: DataSource,
    private readonly captchaService: CaptchaService,
    private readonly housesService: HousesService,
  ) {}

  /** Создаёт отзыв, заводя дом и квартиру при необходимости */
  async create(userId: string, dto: CreateReviewDto, ip?: string): Promise<ReviewCreatedDto> {
    if (dto.periodFrom && dto.periodTo && dto.periodFrom > dto.periodTo) {
      throw new BadRequestException('Начало периода съёма позже его конца')
    }

    // Сетевой вызов — до транзакции, чтобы не держать соединение с БД
    await this.captchaService.validate(dto.captchaToken, ip)

    return this.dataSource.transaction(async (em) => {
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
          periodFrom: dto.periodFrom ?? null,
          periodTo: dto.periodTo ?? null,
          status: ReviewStatus.Pending,
        }),
      )

      return {
        reviewId: review.id,
        houseId: house.id,
        apartmentId: apartment.id,
        status: review.status,
      }
    })
  }

  /** Отзывы квартиры, новые сверху */
  async listByApartment(apartmentId: string): Promise<ReviewDto[]> {
    const reviews = await this.reviews.find({
      where: { apartmentId },
      relations: { author: true },
      order: { createdAt: 'DESC' },
    })

    return reviews.map((review) => ({
      id: review.id,
      status: review.status,
      authorName: review.author.nickname,
      text: review.text,
      periodFrom: review.periodFrom,
      periodTo: review.periodTo,
      createdAt: review.createdAt.toISOString(),
    }))
  }
}
