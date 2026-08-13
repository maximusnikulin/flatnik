import { escapeHtml, MESSAGE_LIMIT } from '../telegram/telegram.client'
import type { TelegramReplyMarkup } from '../telegram/telegram.types'
import type { Review } from './review.entity'

/** '2024-03-12' → '12.03.2024' */
function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

function formatPeriod(review: Review): string | null {
  const { periodFrom, periodTo } = review
  if (periodFrom && periodTo) return `${formatDate(periodFrom)} — ${formatDate(periodTo)}`
  if (periodFrom) return `с ${formatDate(periodFrom)}`
  if (periodTo) return `по ${formatDate(periodTo)}`
  return null
}

/**
 * Карточка отзыва для модератора; отзыв нужен с relations `apartment.house` и
 * `author`. Текст обрезается: лимит сообщения Bot API — 4096 символов, а отзыв
 * разрешён до 10000.
 */
export function buildReviewCard(review: Review, isRepeat: boolean): string {
  const { apartment, author } = review
  const period = formatPeriod(review)
  const text =
    review.text.length > MESSAGE_LIMIT ? `${review.text.slice(0, MESSAGE_LIMIT)}…` : review.text

  const lines = [
    isRepeat ? '♻️ <b>Отзыв исправлен и отправлен заново</b>' : '🆕 <b>Новый отзыв на проверку</b>',
    '',
    `📍 ${escapeHtml(apartment.house.address)}`,
    `🚪 Кв. ${escapeHtml(apartment.number)}, подъезд ${escapeHtml(apartment.entrance)}`,
    `📄 ЕГРН: ${escapeHtml(review.egrn)}`,
    `👤 ${escapeHtml(author.nickname)}`,
  ]
  if (period) {
    lines.push(`📅 Период съёма: ${period}`)
  }
  lines.push('', escapeHtml(text))

  return lines.join('\n')
}

/** Кнопки под карточкой; id отзыва едет в callback_data, лимит там — 64 байта */
export function buildModerationKeyboard(reviewId: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Одобрить', callback_data: `approve:${reviewId}` },
        { text: '❌ Отклонить', callback_data: `reject:${reviewId}` },
      ],
    ],
  }
}
