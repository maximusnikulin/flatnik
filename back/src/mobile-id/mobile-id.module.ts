import { Module } from '@nestjs/common'
import { SmsAeroClient } from './smsaero.client'
import { MobileIdService } from './mobile-id.service'

@Module({
  providers: [SmsAeroClient, MobileIdService],
  exports: [MobileIdService],
})
export class MobileIdModule {}
