import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm'
import { CaptchaService } from '../captcha/captcha.service'
import { toHouseSlugsDto } from '../houses/houses.dto'
import { HousesService } from '../houses/houses.service'
import { UsersService } from '../users/users.service'
import { ModerationService } from './moderation.service'
import { Review } from './review.entity'
import { ReviewStatus } from './review-status'
import { trustLevel } from './review-trust'
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

/** Раньше этого месяца период не принимаем: почти наверняка опечатка в годе */
const MIN_MONTH = '1990-01'

/** Текущий месяц — верхняя граница: отзыв о съёме в будущем смысла не имеет */
function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Границы и порядок концов периода. Формат «ГГГГ-ММ» уже гарантирован @Matches
 * в DTO, поэтому месяцы можно сравнивать как строки — лексикографический
 * порядок здесь совпадает с хронологическим. Те же правила проверяет форма
 * на клиенте; тут они на случай запроса мимо неё.
 */
function assertPeriod(periodFrom?: string, periodTo?: string): void {
  if (periodFrom && periodTo && periodFrom > periodTo) {
    throw new BadRequestException('Начало периода съёма позже его конца')
  }

  const max = currentMonth()
  for (const month of [periodFrom, periodTo]) {
    if (!month) continue
    if (month < MIN_MONTH) {
      throw new BadRequestException('Период съёма не может быть раньше 01.1990')
    }
    if (month > max) {
      throw new BadRequestException('Период съёма не может быть позже текущего месяца')
    }
  }
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
    private readonly usersService: UsersService,
  ) {}

  /** Создаёт отзыв, заводя дом и квартиру при необходимости */
  async create(userId: string, dto: CreateReviewDto, ip?: string): Promise<ReviewCreatedDto> {
    assertPeriod(dto.periodFrom, dto.periodTo)

    // Решение модератора уходит автору письмом, поэтому подтверждённая почта —
    // обязательное условие отзыва. Форма её и так требует, но проверка нужна
    // здесь: иначе требование обходится прямым запросом к API
    const author = await this.usersService.findById(userId)
    if (!author?.email) {
      throw new BadRequestException('Подтвердите почту — на неё придёт решение модератора')
    }

    // Не более 3 отзывов в сутки — до капчи, чтобы не тратить токены впустую
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await this.reviews.count({
      where: { authorId: userId, createdAt: MoreThanOrEqual(todayStart) },
    })
    if (todayCount >= 3) {
      throw new HttpException('Вы можете оставить не более 3 отзывов в сутки', HttpStatus.TOO_MANY_REQUESTS)
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

      // Один пользователь — один отзыв на квартиру; проверяем внутри транзакции,
      // чтобы исключить гонку с конкурентными запросами
      const existing = await em.findOne(Review, {
        where: { authorId: userId, apartmentId: apartment.id },
      })
      if (existing) {
        throw new ConflictException('Вы уже оставляли отзыв на эту квартиру')
      }

      const review = await em.save(
        em.create(Review, {
          apartmentId: apartment.id,
          authorId: userId,
          // Принимаем кадастровый номер или рег. запись права; оба варианта
          // хранятся в одном поле — формат однозначно различимый (рег. запись
          // содержит дефис после кадастрового номера)
          egrn: dto.egrn ?? dto.regRecord ?? null,
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
    assertPeriod(dto.periodFrom, dto.periodTo)

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
      trustLevel: trustLevel(review.egrn),
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
      trustLevel: trustLevel(review.egrn),
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      apartmentId: review.apartmentId,
      apartmentNumber: review.apartment.number,
      entrance: review.apartment.entrance,
      address: review.apartment.house.address,
      slug: toHouseSlugsDto(review.apartment.house),
      lat: review.apartment.house.lat,
      lon: review.apartment.house.lon,
    }
  }
}
