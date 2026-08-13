import { Module } from '@nestjs/common'
import { TelegramClient } from './telegram.client'

/**
 * Только транспорт Bot API — про отзывы и модерацию модуль не знает ничего.
 * Благодаря этому зависимость односторонняя: ReviewsModule → TelegramModule.
 */
@Module({
  providers: [TelegramClient],
  exports: [TelegramClient],
})
export class TelegramModule {}
