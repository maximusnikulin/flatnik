import { DataSource } from 'typeorm'
import { AuthCode } from '../auth/auth-code.entity'
import { Apartment } from '../houses/apartment.entity'
import { House } from '../houses/house.entity'
import { Review } from '../reviews/review.entity'
import { User } from '../users/user.entity'

/**
 * DataSource для CLI TypeORM (migration:generate / run / revert).
 *
 * Приложение поднимает своё подключение через TypeOrmModule и сюда не ходит —
 * здесь дублируется только чтение переменных окружения, дефолты те же, что в
 * config/database.config.ts. Переменные берутся из окружения процесса: CLI
 * запускается внутри контейнера back, где .env уже разложен docker compose.
 *
 * Сущности перечислены явно, а не глобом: glob по-разному раскрывается из src
 * под ts-node и из dist под node, и промах молча даёт пустую схему.
 */
export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  username: process.env.POSTGRES_USER ?? 'flatnik',
  password: process.env.POSTGRES_PASSWORD ?? 'flatnik',
  database: process.env.POSTGRES_DB ?? 'flatnik',
  entities: [User, House, Apartment, Review, AuthCode],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
})
