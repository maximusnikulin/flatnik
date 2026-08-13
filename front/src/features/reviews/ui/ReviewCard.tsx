import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Review } from '@flatnik/shared'

/** Свыше этого порога текст сворачивается кнопкой «Раскрыть» */
const COLLAPSE_THRESHOLD = 200

/** '2024-03-12' → '12.03.24'; ISO-дату со временем режем по 'T' */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}.${month}.${year.slice(2)}`
}

function formatPeriod(review: ReviewCardData): string | null {
  const { periodFrom, periodTo } = review
  if (periodFrom && periodTo) return `Период съёма с ${formatDate(periodFrom)} по ${formatDate(periodTo)}`
  if (periodFrom) return `Период съёма с ${formatDate(periodFrom)}`
  if (periodTo) return `Период съёма по ${formatDate(periodTo)}`
  return null
}

/** Общая часть отзыва квартиры и своего отзыва — всё, что рисует карточка */
export type ReviewCardData = Pick<Review, 'status' | 'text' | 'periodFrom' | 'periodTo'>

interface ReviewCardProps {
  review: ReviewCardData
  /** Шапка: ник автора в отзывах квартиры, адрес — в «Моих отзывах» */
  header: ReactNode
  /** Низ карточки: действия над своим отзывом */
  footer?: ReactNode
  /** Причина отклонения; её видит только автор, поэтому передаётся отдельно от отзыва */
  rejectionReason?: string | null
  /** Выделить карточку: её дом сейчас отмечен на карте */
  isActive?: boolean
}

/** Статус отзыва строкой: плашка над шапкой карточки */
function StatusLine({ status }: { status: ReviewCardData['status'] }) {
  if (status === 'confirmed') {
    return <p className="review-card__status -confirmed">✓ Отзыв подтверждён</p>
  }
  if (status === 'rejected') {
    return <p className="review-card__status -rejected">✕ Отзыв отклонён</p>
  }
  return <p className="review-card__status -pending">⚠ Отзыв не подтверждён</p>
}

/** Карточка отзыва: статус, шапка, текст со сворачиванием, период съёма */
export function ReviewCard({
  review,
  header,
  footer,
  rejectionReason,
  isActive = false,
}: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = review.text.length > COLLAPSE_THRESHOLD
  const text = !isLong || expanded ? review.text : `${review.text.slice(0, COLLAPSE_THRESHOLD)}…`
  const period = formatPeriod(review)

  return (
    <article className={isActive ? 'review-card -active' : 'review-card'}>
      <StatusLine status={review.status} />
      {rejectionReason && (
        <p className="review-card__reason">
          <span className="review-card__reason-label">Причина:</span> {rejectionReason}
        </p>
      )}
      {header}
      <p className="review-card__text">
        {text}
        {isLong && (
          <button type="button" className="review-card__toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Свернуть' : 'Раскрыть'}
          </button>
        )}
      </p>
      {period && <p className="review-card__period">{period}</p>}
      {footer}
    </article>
  )
}
