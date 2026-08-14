import { Module } from '@nestjs/common'
import { SmsAeroClient } from './smsaero.client'
import { SmsService } from './sms.service'
import { MobileIdService } from './mobile-id.service'

@Module({
  providers: [SmsAeroClient, SmsService, MobileIdService],
  exports: [SmsService, MobileIdService],
})
export class SmsModule {}
