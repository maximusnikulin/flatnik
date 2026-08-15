/** Шкала оценки; те же границы стоят в CreateReviewDto на бэкенде */
const MAX_RATING = 5

const HINTS = ['Ужасно', 'Плохо', 'Сносно', 'Хорошо', 'Отлично']

interface RatingInputProps {
  value: number | null
  onChange: (rating: number) => void
  /** Общее имя группы радиокнопок в пределах формы */
  name?: string
}

/**
 * Оценка звёздами. Под звёздами лежат настоящие радиокнопки: так работают
 * стрелки, Tab и скринридеры, а браузер сам не даёт отправить форму без выбора.
 */
export function RatingInput({ value, onChange, name = 'rating' }: RatingInputProps) {
  const options = Array.from({ length: MAX_RATING }, (_, index) => index + 1)

  return (
    <div className="rating-input" role="radiogroup" aria-label="Оценка квартиры">
      {options.map((option) => (
        <label
          key={option}
          className={value !== null && option <= value ? 'rating-input__star -on' : 'rating-input__star'}
          title={HINTS[option - 1]}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            required
          />
          <span aria-hidden="true">★</span>
          <span className="visually-hidden">{`${option} — ${HINTS[option - 1]}`}</span>
        </label>
      ))}
    </div>
  )
}
