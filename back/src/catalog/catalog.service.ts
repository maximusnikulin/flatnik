import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Apartment } from '../houses/apartment.entity'
import { House } from '../houses/house.entity'
import { Review } from '../reviews/review.entity'
import { ReviewStatus } from '../reviews/review-status'
import type {
  CityListItemDto,
  CityPageDto,
  HouseApartmentDto,
  HousePageDto,
  HouseReviewDto,
  StreetHouseDto,
  StreetListItemDto,
  StreetPageDto,
} from './catalog.dto'

/** Размер страницы в списках улиц и домов */
const PAGE_SIZE = 100

/**
 * Потолок отзывов на странице дома. 200 отзывов по 500 символов — это уже
 * ~100 КБ разметки; дальше нужна постраничная выдача со ссылками, иначе
 * страница станет тяжёлой для обхода.
 */
const HOUSE_REVIEWS_LIMIT = 200

/** Агрегаты приходят из pg строками, даже COUNT и AVG */
interface CityRow {
  citySlug: string
  cityName: string
  houseCount: string
  reviewCount: string
}

interface StreetRow {
  streetSlug: string
  streetName: string
  houseCount: string
  reviewCount: string
  ratingAvg: string | null
}

interface StreetHouseRow {
  id: string
  houseSlug: string
  address: string
  reviewCount: string
  ratingAvg: string | null
  /** Отзывов с оценкой: AVG и COUNT(колонка) в pg игнорируют NULL */
  ratingCount: string
}

interface ApartmentRow {
  id: string
  number: string
  entrance: string
  reviewCount: string
  ratingAvg: string | null
}

/** Среднюю оценку показываем с одним знаком: «4.3» */
function toAverage(value: string | null): number | null {
  return value === null ? null : Math.round(Number(value) * 10) / 10
}

/** Номер дома из адреса; в слаге он уже транслитерирован и для показа не годится */
function houseNumberOf(address: string): string {
  const parts = address.split(',').map((part) => part.trim())
  return parts[parts.length - 1] || address
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(House)
    private readonly houses: Repository<House>,
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
  ) {}

  /**
   * Города, где есть хотя бы один подтверждённый отзыв.
   *
   * Все выборки каталога соединяются одинаково: дом → квартира → подтверждённый
   * отзыв. Дом без таких отзывов публично не существует, как и на карте.
   */
  async listCities(): Promise<CityListItemDto[]> {
    const rows = await this.confirmedHouses()
      .select('house.citySlug', 'citySlug')
      .addSelect('MIN(house.cityName)', 'cityName')
      .addSelect('COUNT(DISTINCT house.id)', 'houseCount')
      .addSelect('COUNT(*)', 'reviewCount')
      .groupBy('house.citySlug')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('MIN(house.cityName)', 'ASC')
      .getRawMany<CityRow>()

    return rows.map((row) => ({
      citySlug: row.citySlug,
      cityName: row.cityName,
      houseCount: Number(row.houseCount),
      reviewCount: Number(row.reviewCount),
    }))
  }

  /** Улицы города; null — города с таким слагом нет */
  async findCity(citySlug: string, page: number): Promise<CityPageDto | null> {
    const rows = await this.confirmedHouses()
      .select('house.streetSlug', 'streetSlug')
      .addSelect('MIN(house.streetName)', 'streetName')
      .addSelect('MIN(house.cityName)', 'cityName')
      .addSelect('COUNT(DISTINCT house.id)', 'houseCount')
      .addSelect('COUNT(*)', 'reviewCount')
      .addSelect('AVG(review.rating)', 'ratingAvg')
      .where('house.citySlug = :citySlug', { citySlug })
      .groupBy('house.streetSlug')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('MIN(house.streetName)', 'ASC')
      .getRawMany<StreetRow & { cityName: string }>()

    if (rows.length === 0) {
      return null
    }

    const streets: StreetListItemDto[] = rows
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((row) => ({
        streetSlug: row.streetSlug,
        streetName: row.streetName,
        houseCount: Number(row.houseCount),
        reviewCount: Number(row.reviewCount),
        ratingAvg: toAverage(row.ratingAvg),
      }))

    return {
      citySlug,
      cityName: rows[0].cityName,
      // Дом с отзывами на нескольких улицах не бывает, поэтому суммы честные
      houseCount: rows.reduce((sum, row) => sum + Number(row.houseCount), 0),
      reviewCount: rows.reduce((sum, row) => sum + Number(row.reviewCount), 0),
      streets,
      streetCount: rows.length,
    }
  }

  /** Дома улицы; null — улицы с такими слагами нет */
  async findStreet(citySlug: string, streetSlug: string, page: number): Promise<StreetPageDto | null> {
    const rows = await this.confirmedHouses()
      .select('house.id', 'id')
      .addSelect('MIN(house.houseSlug)', 'houseSlug')
      .addSelect('MIN(house.address)', 'address')
      .addSelect('COUNT(*)', 'reviewCount')
      .addSelect('AVG(review.rating)', 'ratingAvg')
      .addSelect('COUNT(review.rating)', 'ratingCount')
      .where('house.citySlug = :citySlug AND house.streetSlug = :streetSlug', {
        citySlug,
        streetSlug,
      })
      .groupBy('house.id')
      // Номера сортируются по-человечески: 2 раньше 10
      .orderBy('LENGTH(MIN(house.houseSlug))', 'ASC')
      .addOrderBy('MIN(house.houseSlug)', 'ASC')
      .getRawMany<StreetHouseRow>()

    if (rows.length === 0) {
      return null
    }

    const names = await this.houses.findOne({
      where: { citySlug, streetSlug },
      select: { cityName: true, streetName: true },
    })

    const houses: StreetHouseDto[] = rows
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((row) => ({
        id: row.id,
        houseSlug: row.houseSlug,
        houseNumber: houseNumberOf(row.address),
        address: row.address,
        reviewCount: Number(row.reviewCount),
        ratingAvg: toAverage(row.ratingAvg),
      }))

    // Средняя по улице взвешена числом ОЦЕНЁННЫХ отзывов: у дома со ста
    // безоценочными отзывами и одной пятёркой вес должен быть единичным
    const ratingCount = rows.reduce((sum, row) => sum + Number(row.ratingCount), 0)
    const ratingSum = rows.reduce(
      (sum, row) => sum + Number(row.ratingAvg ?? 0) * Number(row.ratingCount),
      0,
    )

    return {
      citySlug,
      cityName: names?.cityName ?? '',
      streetSlug,
      streetName: names?.streetName ?? '',
      reviewCount: rows.reduce((sum, row) => sum + Number(row.reviewCount), 0),
      ratingAvg: ratingCount === 0 ? null : Math.round((ratingSum / ratingCount) * 10) / 10,
      houses,
      houseCount: rows.length,
    }
  }

  /** Дом со всеми подтверждёнными отзывами; null — дома с такими слагами нет */
  async findHouse(
    citySlug: string,
    streetSlug: string,
    houseSlug: string,
  ): Promise<HousePageDto | null> {
    const house = await this.houses.findOneBy({ citySlug, streetSlug, houseSlug })
    if (!house) {
      return null
    }

    const apartmentRows = await this.apartments
      .createQueryBuilder('apartment')
      .innerJoin(
        Review,
        'review',
        'review.apartmentId = apartment.id AND review.status = :confirmed',
      )
      .select('apartment.id', 'id')
      .addSelect('apartment.number', 'number')
      .addSelect('apartment.entrance', 'entrance')
      .addSelect('COUNT(*)', 'reviewCount')
      .addSelect('AVG(review.rating)', 'ratingAvg')
      .setParameters({ confirmed: ReviewStatus.Confirmed })
      .where('apartment.houseId = :houseId', { houseId: house.id })
      .groupBy('apartment.id')
      .orderBy('LENGTH(apartment.number)', 'ASC')
      .addOrderBy('apartment.number', 'ASC')
      .getRawMany<ApartmentRow>()

    const reviews = await this.reviews
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.apartment', 'apartment')
      .innerJoinAndSelect('review.author', 'author')
      .where('apartment.houseId = :houseId AND review.status = :confirmed', {
        houseId: house.id,
        confirmed: ReviewStatus.Confirmed,
      })
      .orderBy('review.createdAt', 'DESC')
      .limit(HOUSE_REVIEWS_LIMIT)
      .getMany()

    const rated = reviews.filter((review) => review.rating !== null)
    const updatedAt = reviews.reduce<Date | null>(
      (latest, review) => (latest === null || review.updatedAt > latest ? review.updatedAt : latest),
      null,
    )

    const apartments: HouseApartmentDto[] = apartmentRows.map((row) => ({
      id: row.id,
      number: row.number,
      entrance: row.entrance,
      reviewCount: Number(row.reviewCount),
      ratingAvg: toAverage(row.ratingAvg),
    }))

    return {
      id: house.id,
      address: house.address,
      citySlug,
      cityName: house.cityName ?? '',
      streetSlug,
      streetName: house.streetName ?? '',
      houseSlug,
      houseNumber: houseNumberOf(house.address),
      lat: house.lat,
      lon: house.lon,
      reviewCount: reviews.length,
      ratingAvg:
        rated.length === 0
          ? null
          : Math.round((rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length) * 10) / 10,
      ratingCount: rated.length,
      updatedAt: updatedAt?.toISOString() ?? null,
      apartments,
      reviews: reviews.map<HouseReviewDto>((review) => ({
        id: review.id,
        status: review.status,
        authorName: review.author.nickname,
        text: review.text,
        rating: review.rating,
        periodFrom: review.periodFrom ? review.periodFrom.slice(0, 7) : null,
        periodTo: review.periodTo ? review.periodTo.slice(0, 7) : null,
        createdAt: review.createdAt.toISOString(),
        apartmentId: review.apartmentId,
        apartmentNumber: review.apartment.number,
        entrance: review.apartment.entrance,
      })),
    }
  }

  /**
   * Общая основа всех выборок: дома со слагами, у которых есть подтверждённые
   * отзывы. Дом без слагов публичной страницы не имеет и в каталог не попадает.
   */
  private confirmedHouses() {
    return this.houses
      .createQueryBuilder('house')
      .innerJoin(Apartment, 'apartment', 'apartment.houseId = house.id')
      .innerJoin(
        Review,
        'review',
        'review.apartmentId = apartment.id AND review.status = :confirmed',
      )
      .setParameters({ confirmed: ReviewStatus.Confirmed })
      .andWhere('house.citySlug IS NOT NULL')
  }
}
