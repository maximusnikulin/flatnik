/** Части схемы Bot API, которые использует модерация; остальные поля отброшены */

export interface TelegramChat {
  id: number
}

export interface TelegramMessage {
  message_id: number
  chat: TelegramChat
  text?: string
  reply_to_message?: TelegramMessage
}

export interface TelegramCallbackQuery {
  id: string
  data?: string
  message?: TelegramMessage
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

/** Клавиатура под сообщением или просьба ответить на него */
export interface TelegramReplyMarkup {
  inline_keyboard?: InlineKeyboardButton[][]
  force_reply?: boolean
}
