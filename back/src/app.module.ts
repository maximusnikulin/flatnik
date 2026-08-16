import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './health/health.controller'
import { databaseConfig } from './config/database.config'
import { authConfig } from './config/auth.config'
import { captchaConfig } from './config/captcha.config'
import { smsConfig } from './config/sms.config'
import { telegramConfig } from './config/telegram.config'
import { seoConfig } from './config/seo.config'
import { DatabaseModule } from './database/database.module'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { CaptchaModule } from './captcha/captcha.module'
import { HousesModule } from './houses/houses.module'
import { ReviewsModule } from './reviews/reviews.module'
import { CatalogModule } from './catalog/catalog.module'
import { SeoModule } from './seo/seo.module'

@Module({
  imports: [
    // Единственная точка чтения окружения; '../.env' — корневой .env,
    // потому что npm-скрипты воркспейса запускаются с cwd = back/
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, captchaConfig, smsConfig, telegramConfig, seoConfig],
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    CaptchaModule,
    HousesModule,
    ReviewsModule,
    CatalogModule,
    SeoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
