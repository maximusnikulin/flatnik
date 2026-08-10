import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Возвращает пользователя по телефону, создавая его при первом входе */
  async getOrCreateByPhone(phone: string): Promise<User> {
    const existing = await this.users.findOneBy({ phone })
    if (existing) return existing

    // ON CONFLICT DO NOTHING закрывает гонку двух параллельных verify
    await this.users.createQueryBuilder().insert().values({ phone }).orIgnore().execute()
    return this.users.findOneByOrFail({ phone })
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id })
  }
}
