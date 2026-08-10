import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { CaptchaModule } from '../captcha/captcha.module'
import { HousesModule } from '../houses/houses.module'
import { Review } from './review.entity'
import { ReviewsService } from './reviews.service'
import { ReviewsController } from './reviews.controller'
import { ApartmentReviewsController } from './apartment-reviews.controller'

@Module({
  // AuthModule даёт JwtService для JwtAuthGuard на POST /reviews
  imports: [TypeOrmModule.forFeature([Review]), AuthModule, CaptchaModule, HousesModule],
  controllers: [ReviewsController, ApartmentReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
