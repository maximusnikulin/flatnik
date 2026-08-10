import { registerAs } from '@nestjs/config'

/** Подключение к Postgres; дефолты совпадают с docker-compose и .env.example */
export const databaseConfig = registerAs('database', () => ({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER ?? 'flatnik',
  password: process.env.POSTGRES_PASSWORD ?? 'flatnik',
  name: process.env.POSTGRES_DB ?? 'flatnik',
}))
