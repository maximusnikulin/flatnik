import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { House } from './house.entity'
import { Apartment } from './apartment.entity'
import { HousesService } from './houses.service'
import { HousesController } from './houses.controller'

@Module({
  imports: [TypeOrmModule.forFeature([House, Apartment])],
  controllers: [HousesController],
  providers: [HousesService],
  exports: [HousesService],
})
export class HousesModule {}
