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
        // Схему ведут миграции — и в dev, и в prod. synchronize выключен
        // намеренно: он не переживает переименований и молча разъезжается
        // с миграциями, после чего migration:generate выдаёт диффы против
        // схемы, которую никто не ревьюил.
        synchronize: false,
        // Одна нода на окружение, поэтому применяем миграции на старте:
        // отдельный шаг в деплое давал бы окно, когда новый код уже работает
        // на старой схеме. Список — тот же, что у CLI (data-source.ts).
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
        // Выгрузка OpenAPI-схемы (npm run openapi) поднимает приложение без
        // listen(), БД ей не нужна: DataSource создаётся, но не подключается.
        manualInitialization: process.env.OPENAPI_GEN === '1',
      }),
    }),
  ],
})
export class DatabaseModule {}
