import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Apartment } from '../houses/apartment.entity'
import { House } from '../houses/house.entity'
import { Review } from '../reviews/review.entity'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'

// Сущности берутся напрямую, без HousesModule и ReviewsModule: каталог только
// читает данные, а зависимость от модулей потянула бы за собой их сервисы.
@Module({
  imports: [TypeOrmModule.forFeature([House, Apartment, Review])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
