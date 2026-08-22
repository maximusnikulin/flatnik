import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../auth/model/auth.store'
import { apartmentReviewsQuery, myReviewsQuery } from '../api/reviews.api'
import { ReviewCard } from './ReviewCard'

interface ReviewsPanelProps {
  apartmentId: string
  apartmentNumber: string
  entrance: string
  /** Отзыв об этой квартире только что отправлен — объясняем, почему его не видно */
  justSubmitted: boolean
  onBack: () => void
  onAddReview: () => void
}

/** Панель отзывов одной квартиры; публично видны только подтверждённые */
export function ReviewsPanel({
  apartmentId,
  apartmentNumber,
  entrance,
  justSubmitted,
  onBack,
  onAddReview,
}: ReviewsPanelProps) {
  const { data, isPending, error } = useQuery(apartmentReviewsQuery(apartmentId))
  const token = useAuthStore((s) => s.token)
  const { data: myReviews } = useQuery(myReviewsQuery(!!token))
  const alreadyReviewed = myReviews?.some((r) => r.apartmentId === apartmentId) ?? false

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
          justSubmitted ? (
            <p className="panel-note">
              Отзыв отправлен на проверку — он появится здесь после модерации. Следить за
              статусом можно в «Моих отзывах».
            </p>
          ) : (
            <p className="panel-note">Отзывов пока нет.</p>
          )
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

      {!alreadyReviewed && (
        <button type="button" className="btn-primary" onClick={onAddReview}>
          Добавить отзыв
        </button>
      )}
    </section>
  )
}
