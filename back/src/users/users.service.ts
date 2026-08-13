import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { User } from './user.entity'

/** Код нарушения уникального индекса в Postgres */
const UNIQUE_VIOLATION = '23505'

/** Сколько раз пробуем сгенерировать свободный ник, прежде чем сдаться */
const NICKNAME_ATTEMPTS = 5

function generateNickname(): string {
  const suffix = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
  return `user_${suffix}`
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Возвращает пользователя по телефону, создавая его при первом входе.
   * Ник выдаётся сразу и случайный: отзыв должен быть чем-то подписан ещё до
   * того, как человек выберет имя. Флаг nicknameConfirmed остаётся false,
   * по нему фронт понимает, что надо попросить настоящий ник.
   */
  async getOrCreateByPhone(phone: string): Promise<User> {
    const existing = await this.users.findOneBy({ phone })
    if (existing) return existing

    for (let attempt = 0; attempt < NICKNAME_ATTEMPTS; attempt++) {
      const nickname = generateNickname()
      // orIgnore закрывает гонку двух параллельных verify по одному телефону,
      // но он же проглатывает и коллизию ника — поэтому после вставки
      // перепроверяем, появилась ли строка, и при неудаче берём новый ник.
      await this.users
        .createQueryBuilder()
        .insert()
        .values({ phone, nickname, nicknameLower: nickname.toLowerCase() })
        .orIgnore()
        .execute()

      const created = await this.users.findOneBy({ phone })
      if (created) return created
    }

    throw new ConflictException('Не удалось подобрать свободный никнейм')
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id })
  }

  /**
   * Задаёт выбранный пользователем ник и помечает его подтверждённым.
   * Занятость проверяем без учёта регистра, чтобы рядом не заводились
   * «Максим» и «максим» — на отзывах это выглядело бы как один и тот же автор.
   */
  async setNickname(userId: string, nickname: string): Promise<User> {
    const nicknameLower = nickname.toLowerCase()

    const taken = await this.users.findOneBy({ nicknameLower })
    if (taken && taken.id !== userId) {
      throw new ConflictException('Никнейм уже занят')
    }

    try {
      await this.users.update(userId, { nickname, nicknameLower, nicknameConfirmed: true })
    } catch (error) {
      // Проверка выше не атомарна: между ней и update ник мог занять кто-то ещё
      if (isUniqueViolation(error)) {
        throw new ConflictException('Никнейм уже занят')
      }
      throw error
    }

    return this.users.findOneByOrFail({ id: userId })
  }
}
