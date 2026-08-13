import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { EntityManager } from 'typeorm'
import { House } from './house.entity'
import { Apartment } from './apartment.entity'
// Только класс сущности для QueryBuilder — зависимости от ReviewsModule нет
import { Review } from '../reviews/review.entity'
import { ReviewStatus } from '../reviews/review-status'
import { normalizeAddressKey } from './address-key.util'
import type {
  ApartmentSummaryDto,
  HouseLookupResponseDto,
  HousePinDto,
} from './houses.dto'

/** COUNT из raw-запросов pg возвращает строками */
interface PinRow {
  id: string
  address: string
  lat: number
  lon: number
  confirmedCount: string
  pendingCount: string
}

interface ApartmentRow {
  id: string
  number: string
  entrance: string
  confirmedCount: string
  pendingCount: string
}

@Injectable()
export class HousesService {
  constructor(
    @InjectRepository(House)
    private readonly houses: Repository<House>,
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
  ) {}

  /** Дома, у которых есть хотя бы один отзыв, — пины на карте */
  async findPins(): Promise<HousePinDto[]> {
    const rows = await this.houses
      .createQueryBuilder('house')
      .innerJoin(Apartment, 'apartment', 'apartment.houseId = house.id')
      // Отклонённые отзывы не считаются: дом, где остались только они,
      // не должен висеть пином с нулевыми счётчиками
      .innerJoin(
        Review,
        'review',
        'review.apartmentId = apartment.id AND review.status != :rejected',
      )
      .select('house.id', 'id')
      .addSelect('house.address', 'address')
      .addSelect('house.lat', 'lat')
      .addSelect('house.lon', 'lon')
      .addSelect('COUNT(*) FILTER (WHERE review.status = :confirmed)', 'confirmedCount')
      .addSelect('COUNT(*) FILTER (WHERE review.status = :pending)', 'pendingCount')
      .setParameters({
        confirmed: ReviewStatus.Confirmed,
        pending: ReviewStatus.Pending,
        rejected: ReviewStatus.Rejected,
      })
      .groupBy('house.id')
      .getRawMany<PinRow>()

    return rows.map((row) => ({
      id: row.id,
      address: row.address,
      lat: row.lat,
      lon: row.lon,
      confirmedCount: Number(row.confirmedCount),
      pendingCount: Number(row.pendingCount),
    }))
  }

  /** Дом с квартирами и счётчиками отзывов по каноническому адресу */
  async findByAddress(address: string): Promise<HouseLookupResponseDto> {
    const house = await this.houses.findOneBy({ addressKey: normalizeAddressKey(address) })
    if (!house) {
      return { house: null }
    }

    const rows = await this.apartments
      .createQueryBuilder('apartment')
      .leftJoin(Review, 'review', 'review.apartmentId = apartment.id')
      .select('apartment.id', 'id')
      .addSelect('apartment.number', 'number')
      .addSelect('apartment.entrance', 'entrance')
      .addSelect('COUNT(review.id) FILTER (WHERE review.status = :confirmed)', 'confirmedCount')
      .addSelect('COUNT(review.id) FILTER (WHERE review.status = :pending)', 'pendingCount')
      .setParameters({ confirmed: ReviewStatus.Confirmed, pending: ReviewStatus.Pending })
      .where('apartment.houseId = :houseId', { houseId: house.id })
      .groupBy('apartment.id')
      // Числовые номера сортируются по-человечески: 2 раньше 10
      .orderBy('LENGTH(apartment.number)', 'ASC')
      .addOrderBy('apartment.number', 'ASC')
      .getRawMany<ApartmentRow>()

    const apartments: ApartmentSummaryDto[] = rows.map((row) => ({
      id: row.id,
      number: row.number,
      entrance: row.entrance,
      confirmedCount: Number(row.confirmedCount),
      pendingCount: Number(row.pendingCount),
    }))

    return {
      house: {
        id: house.id,
        address: house.address,
        lat: house.lat,
        lon: house.lon,
        apartments,
      },
    }
  }

  /** Находит или создаёт дом; вызывается внутри транзакции создания отзыва */
  async getOrCreateHouse(
    em: EntityManager,
    params: { address: string; lat: number; lon: number },
  ): Promise<House> {
    const addressKey = normalizeAddressKey(params.address)
    const existing = await em.findOneBy(House, { addressKey })
    if (existing) {
      // Координаты и написание адреса зафиксированы первой записью
      return existing
    }

    // ON CONFLICT DO NOTHING: проигрыш гонки не валит транзакцию,
    // повторный SELECT забирает запись победителя
    await em
      .createQueryBuilder()
      .insert()
      .into(House)
      .values({ address: params.address, addressKey, lat: params.lat, lon: params.lon })
      .orIgnore()
      .execute()
    return em.findOneByOrFail(House, { addressKey })
  }

  /** Находит или создаёт квартиру; подъезд существующей не перезаписывается */
  async getOrCreateApartment(
    em: EntityManager,
    params: { houseId: string; number: string; entrance: string },
  ): Promise<Apartment> {
    const existing = await em.findOneBy(Apartment, {
      houseId: params.houseId,
      number: params.number,
    })
    if (existing) {
      return existing
    }

    await em.createQueryBuilder().insert().into(Apartment).values(params).orIgnore().execute()
    return em.findOneByOrFail(Apartment, { houseId: params.houseId, number: params.number })
  }
}
