import { useQuery } from '@tanstack/react-query'
import { apartmentReviewsQuery } from '../api/reviews.api'
import { ReviewCard } from './ReviewCard'

interface ReviewsPanelProps {
  apartmentId: string
  apartmentNumber: string
  entrance: string
  onBack: () => void
  onAddReview: () => void
}

/** Панель отзывов одной квартиры */
export function ReviewsPanel({
  apartmentId,
  apartmentNumber,
  entrance,
  onBack,
  onAddReview,
}: ReviewsPanelProps) {
  const { data, isPending, error } = useQuery(apartmentReviewsQuery(apartmentId))

  return (
    <section className="floating-panel">
      <button type="button" className="back-link" onClick={onBack}>
        ← Подъезд {entrance}
      </button>
      <h2 className="panel-title">Квартира {apartmentNumber}</h2>

      {isPending && <p className="panel-note">Загружаем…</p>}
      {error && <p className="panel-note -error">Не удалось загрузить отзывы: {error.message}</p>}
      {data &&
        (data.length === 0 ? (
          <p className="panel-note">Отзывов пока нет.</p>
        ) : (
          <div className="panel-list">
            {data.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                header={<p className="review-card__author">{review.authorName}</p>}
              />
            ))}
          </div>
        ))}

      <button type="button" className="btn-primary" onClick={onAddReview}>
        Добавить отзыв
      </button>
    </section>
  )
}
