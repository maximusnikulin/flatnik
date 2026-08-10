import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import type { ConfigType } from '@nestjs/config'
import { databaseConfig } from '../config/database.config'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres',
        host: db.host,
        port: db.port,
        username: db.user,
        password: db.password,
        database: db.name,
        // Сущности регистрируют модули фич через forFeature
        autoLoadEntities: true,
        // Этап скелета: схему БД ведёт synchronize. До появления реальных
        // данных заменить на миграции — переименований он не переживает.
        synchronize: true,
        // Выгрузка OpenAPI-схемы (npm run openapi) поднимает приложение без
        // listen(), БД ей не нужна: DataSource создаётся, но не подключается.
        manualInitialization: process.env.OPENAPI_GEN === '1',
      }),
    }),
  ],
})
export class DatabaseModule {}
