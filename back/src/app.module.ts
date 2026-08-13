import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './health/health.controller'
import { databaseConfig } from './config/database.config'
import { authConfig } from './config/auth.config'
import { captchaConfig } from './config/captcha.config'
import { smsConfig } from './config/sms.config'
import { DatabaseModule } from './database/database.module'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { CaptchaModule } from './captcha/captcha.module'
import { HousesModule } from './houses/houses.module'
import { ReviewsModule } from './reviews/reviews.module'

@Module({
  imports: [
    // Единственная точка чтения окружения; '../.env' — корневой .env,
    // потому что npm-скрипты воркспейса запускаются с cwd = back/
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, captchaConfig, smsConfig],
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    CaptchaModule,
    HousesModule,
    ReviewsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
