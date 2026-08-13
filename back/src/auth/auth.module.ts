import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import type { ConfigType } from '@nestjs/config'
import { authConfig } from '../config/auth.config'
import { CaptchaModule } from '../captcha/captcha.module'
import { SmsModule } from '../sms/sms.module'
import { UsersModule } from '../users/users.module'
import { AuthCode } from './auth-code.entity'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthCode]),
    UsersModule,
    CaptchaModule,
    SmsModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: ConfigType<typeof authConfig>) => ({
        secret: auth.jwtSecret,
        signOptions: { expiresIn: auth.jwtExpiresIn },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  // JwtModule нужен модулям, вешающим JwtAuthGuard на свои методы
  exports: [JwtModule],
})
export class AuthModule {}
