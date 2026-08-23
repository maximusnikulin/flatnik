/**
 * Уровень доверия отзыва.
 *
 * Определяется по тому, что предоставил автор:
 * - Запись регистрации права (формат с суффиксом -регион/отдел/год-номер)
 *   — прямое подтверждение факта аренды → high
 * - Кадастровый номер или ничего → low
 *
 * Паттерн экспортируется и переиспользуется в @Matches у CreateReviewDto.regRecord.
 */
export const REG_RECORD_PATTERN = /^\d{2}:\d{2}:\d{6,7}:\d{1,10}-\d{2}\/\d{3}\/\d{4}-\d{1,7}$/

export type TrustLevel = 'high' | 'low'

export function trustLevel(egrn: string | null): TrustLevel {
  return egrn !== null && REG_RECORD_PATTERN.test(egrn) ? 'high' : 'low'
}
