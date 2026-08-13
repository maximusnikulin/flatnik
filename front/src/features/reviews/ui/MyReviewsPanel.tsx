import { useQuery } from '@tanstack/react-query'
import type { MyReview } from '@flatnik/shared'
import { ApiError } from '../../../shared/api/fetcher'
import { myReviewsQuery } from '../api/reviews.api'
import { ReviewCard, formatDate } from './ReviewCard'

interface MyReviewsPanelProps {
  onClose: () => void
  /** Клик по адресу — перелететь к дому, панель при этом остаётся открытой */
  onGoToHouse: (house: { address: string; lat: number; lon: number }) => void
  /** Правка своего отзыва — открыть форму с его текущим содержимым */
  onEdit: (review: MyReview) => void
  /** Адрес, чей дом сейчас отмечен на карте; null — маркера нет */
  activeAddress: string | null
}

/** Панель «Мои отзывы»: свои отзывы всех квартир, недавно изменённые сверху */
export function MyReviewsPanel({
  onClose,
  onGoToHouse,
  onEdit,
  activeAddress,
}: MyReviewsPanelProps) {
  const { data, isPending, error } = useQuery(myReviewsQuery(true))

  return (
    <section className="floating-panel">
      <button type="button" className="back-link" onClick={onClose}>
        Закрыть
      </button>
      <h2 className="panel-title">Мои отзывы</h2>

      {isPending && <p className="panel-note">Загружаем…</p>}
      {error && (
        <p className="panel-note -error">
          {error instanceof ApiError && error.status === 401
            ? 'Сессия истекла — войдите заново.'
            : `Не удалось загрузить отзывы: ${error.message}`}
        </p>
      )}
      {data &&
        (data.length === 0 ? (
          <p className="panel-note">
            Вы ещё не оставили ни одного отзыва. Выберите дом на карте и расскажите, как вам
            жилось.
          </p>
        ) : (
          <div className="panel-list">
            {data.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isActive={review.address === activeAddress}
                rejectionReason={review.rejectionReason}
                header={<MyReviewHeader review={review} onGoToHouse={onGoToHouse} />}
                footer={
                  review.status === 'pending' ? (
                    <p className="review-card__note">На проверке — правка недоступна</p>
                  ) : (
                    <button type="button" className="btn-secondary" onClick={() => onEdit(review)}>
                      Изменить отзыв
                    </button>
                  )
                }
              />
            ))}
          </div>
        ))}
    </section>
  )
}

interface MyReviewHeaderProps {
  review: MyReview
  onGoToHouse: MyReviewsPanelProps['onGoToHouse']
}

/** Шапка своей карточки: адрес-кнопка и подпись с квартирой и датой правки */
function MyReviewHeader({ review, onGoToHouse }: MyReviewHeaderProps) {
  return (
    <div className="review-card__header">
      <button
        type="button"
        className="review-card__address"
        onClick={() =>
          onGoToHouse({ address: review.address, lat: review.lat, lon: review.lon })
        }
      >
        {review.address}
      </button>
      <p className="review-card__caption">
        Кв. {review.apartmentNumber}, подъезд {review.entrance} · обновлён{' '}
        {formatDate(review.updatedAt)}
      </p>
    </div>
  )
}
