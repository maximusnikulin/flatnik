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
import { buildHouseSlugs } from './address-slug.util'
import { toHouseSlugsDto } from './houses.dto'
import type { ApartmentSummaryDto, HouseLookupResponseDto, HousePinDto } from './houses.dto'

/** COUNT из raw-запросов pg возвращает строками */
interface PinRow {
  id: string
  address: string
  lat: number
  lon: number
  confirmedCount: string
}

interface ApartmentRow {
  id: string
  number: string
  entrance: string
  confirmedCount: string
}

/** Слаговые колонки дома одним объектом — их пишут вместе или не пишут вовсе */
type HouseSlugColumns = Pick<
  House,
  'citySlug' | 'cityName' | 'streetSlug' | 'streetName' | 'houseSlug'
>

/** Адрес не разобрался: публичной страницы у дома не будет */
const EMPTY_SLUGS: HouseSlugColumns = {
  citySlug: null,
  cityName: null,
  streetSlug: null,
  streetName: null,
  houseSlug: null,
}

@Injectable()
export class HousesService {
  constructor(
    @InjectRepository(House)
    private readonly houses: Repository<House>,
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
  ) {}

  /**
   * Дома, у которых есть хотя бы один подтверждённый отзыв, — пины на карте.
   * Непроверенные и отклонённые публично не существуют, поэтому дом с одними
   * такими отзывами пином не становится.
   */
  async findPins(): Promise<HousePinDto[]> {
    const rows = await this.houses
      .createQueryBuilder('house')
      .innerJoin(Apartment, 'apartment', 'apartment.houseId = house.id')
      .innerJoin(
        Review,
        'review',
        'review.apartmentId = apartment.id AND review.status = :confirmed',
      )
      .select('house.id', 'id')
      .addSelect('house.address', 'address')
      .addSelect('house.lat', 'lat')
      .addSelect('house.lon', 'lon')
      .addSelect('COUNT(*)', 'confirmedCount')
      .setParameters({ confirmed: ReviewStatus.Confirmed })
      .groupBy('house.id')
      .getRawMany<PinRow>()

    return rows.map((row) => ({
      id: row.id,
      address: row.address,
      lat: row.lat,
      lon: row.lon,
      confirmedCount: Number(row.confirmedCount),
    }))
  }

  /**
   * Дом с квартирами и счётчиками подтверждённых отзывов по каноническому адресу.
   * Квартиры без подтверждённых отзывов не отдаются вовсе (innerJoin): такая
   * строка в списке вела бы в заведомо пустую панель отзывов.
   */
  async findByAddress(address: string): Promise<HouseLookupResponseDto> {
    const house = await this.houses.findOneBy({ addressKey: normalizeAddressKey(address) })
    if (!house) {
      // Дома ещё нет, но слаги уже известны: ссылка появится, как только
      // первый отзыв о нём пройдёт модерацию
      return { house: null, slug: toHouseSlugsDto(buildHouseSlugs(address)) }
    }

    const rows = await this.apartments
      .createQueryBuilder('apartment')
      .innerJoin(
        Review,
        'review',
        'review.apartmentId = apartment.id AND review.status = :confirmed',
      )
      .select('apartment.id', 'id')
      .addSelect('apartment.number', 'number')
      .addSelect('apartment.entrance', 'entrance')
      .addSelect('COUNT(*)', 'confirmedCount')
      .setParameters({ confirmed: ReviewStatus.Confirmed })
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
    }))

    const slug = toHouseSlugsDto(house)

    return {
      house: {
        id: house.id,
        address: house.address,
        lat: house.lat,
        lon: house.lon,
        slug,
        apartments,
      },
      slug,
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

    const slugs = await this.buildFreeSlugs(em, params.address)

    // Конфликт сужен до адреса намеренно. С голым orIgnore() коллизия слагов
    // тоже проглатывалась бы молча, и следующий findOneByOrFail падал бы с
    // EntityNotFoundError — то есть 500 на отправке отзыва.
    // Проигрыш гонки по адресу по-прежнему не валит транзакцию: повторный
    // SELECT забирает запись победителя.
    await em
      .createQueryBuilder()
      .insert()
      .into(House)
      .values({ address: params.address, addressKey, lat: params.lat, lon: params.lon, ...slugs })
      .orIgnore('("addressKey")')
      .execute()
    return em.findOneByOrFail(House, { addressKey })
  }

  /**
   * Слаги для нового дома со свободным номером. Разные написания одного адреса
   * дают одинаковый слаг («улица Щорса, 5» и «ул. Щорса, 5»), поэтому занятые
   * номера получают суффикс: 5, 5-2, 5-3.
   *
   * Ловить 23505 в цикле нельзя — ошибка аборчивает транзакцию создания отзыва
   * целиком. Поэтому свободный номер выбирается заранее, а уникальный индекс
   * остаётся страховкой от гонки: проигравший получит 500 и повторит отправку.
   */
  private async buildFreeSlugs(em: EntityManager, address: string): Promise<HouseSlugColumns> {
    const slugs = buildHouseSlugs(address)
    if (!slugs) {
      return EMPTY_SLUGS
    }

    const taken = await em.find(House, {
      where: { citySlug: slugs.citySlug, streetSlug: slugs.streetSlug },
      select: { houseSlug: true },
    })
    const busy = new Set(taken.map((house) => house.houseSlug))

    let houseSlug = slugs.houseSlug
    for (let attempt = 2; busy.has(houseSlug); attempt++) {
      houseSlug = `${slugs.houseSlug}-${attempt}`
    }

    return {
      citySlug: slugs.citySlug,
      cityName: slugs.cityName,
      streetSlug: slugs.streetSlug,
      streetName: slugs.streetName,
      houseSlug,
    }
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
