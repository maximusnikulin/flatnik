/** Шкала оценки; те же границы стоят в CreateReviewDto на бэкенде */
const MAX_RATING = 5

interface RatingStarsProps {
  value: number
}

/** Оценка звёздами только для показа; для ввода есть RatingInput */
export function RatingStars({ value }: RatingStarsProps) {
  const stars = Array.from({ length: MAX_RATING }, (_, index) => index < value)

  return (
    // Звёзды для скринридера — набор символов без смысла, поэтому наружу
    // отдаём число, а сами символы прячем
    <span className="rating-stars" role="img" aria-label={`Оценка ${value} из ${MAX_RATING}`}>
      {stars.map((filled, index) => (
        <span key={index} className={filled ? 'rating-stars__star -on' : 'rating-stars__star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}
