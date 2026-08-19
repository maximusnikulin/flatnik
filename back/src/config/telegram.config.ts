import { registerAs } from '@nestjs/config'

/**
 * Телеграм-бот модерации. Без токена или id чата бот не запускается: отзывы
 * копятся в статусе `pending` и разбираются командой `/pending`, когда бот
 * включат. Приложение при этом стартует в любом окружении — в отличие от капчи
 * и SMS, модерация не влияет на то, чем пользуется посетитель сайта, и падающий
 * из-за бота production хуже неразобранной очереди отзывов.
 */
export const telegramConfig = registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  // id чата модератора; узнаётся из лога бота — он пишет id чужого чата в warn
  moderatorChatId: process.env.TELEGRAM_MODERATOR_CHAT_ID ?? '',
  // HTTP-прокси для окружений, где api.telegram.org заблокирован (например, РФ VPS).
  // Пример: TELEGRAM_PROXY_URL=http://194.180.188.196:8888
  proxyUrl: process.env.TELEGRAM_PROXY_URL ?? '',
}))
