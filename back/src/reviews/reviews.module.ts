import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { CaptchaModule } from '../captcha/captcha.module'
import { HousesModule } from '../houses/houses.module'
import { UsersModule } from '../users/users.module'
import { MailModule } from '../mail/mail.module'
import { TelegramModule } from '../telegram/telegram.module'
import { Review } from './review.entity'
import { ReviewsService } from './reviews.service'
import { ModerationService } from './moderation.service'
import { ReviewsController } from './reviews.controller'
import { ApartmentReviewsController } from './apartment-reviews.controller'

@Module({
  // AuthModule даёт JwtService для JwtAuthGuard на POST /reviews,
  // TelegramModule — транспорт для карточек модератору,
  // MailModule — письмо автору с решением
  imports: [
    TypeOrmModule.forFeature([Review]),
    AuthModule,
    CaptchaModule,
    HousesModule,
    UsersModule,
    MailModule,
    TelegramModule,
  ],
  controllers: [ReviewsController, ApartmentReviewsController],
  providers: [ReviewsService, ModerationService],
})
export class ReviewsModule {}
