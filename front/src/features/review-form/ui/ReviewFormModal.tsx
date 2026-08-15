import { useShallow } from 'zustand/react/shallow'
import { ApiError } from '../../../shared/api/fetcher'
import { useReviewFormStore } from '../model/review-form.store'
import { useCreateReviewMutation } from '../api/create-review'
import { useUpdateReviewMutation } from '../api/update-review'
import { useCaptcha } from '../../../shared/lib/use-captcha'
import { EgrnInput } from '../../../shared/ui/EgrnInput'
import { RatingInput } from '../../../shared/ui/RatingInput'

/** Столько же стоит в CreateReviewDto и UpdateReviewDto на бэкенде */
const TEXT_MAX_LENGTH = 500

interface ReviewFormModalProps {
  /** Дом для нового отзыва; в режиме правки адрес берётся из самого отзыва */
  house: { address: string; lat: number; lon: number } | null
  /** Отзыв создан — открыть панель квартиры */
  onCreated: (apartment: { id: string; number: string; entrance: string }) => void
  /** Токен истёк или отозван — нужно войти заново, черновик сохраняется */
  onUnauthorized: () => void
}

/** Модалка отзыва: адрес, квартира, период, ЕГРН, текст. В режиме правки
 *  меняются только текст и период — остальное определяет уже созданный отзыв */
export function ReviewFormModal({ house, onCreated, onUnauthorized }: ReviewFormModalProps) {
  const form = useReviewFormStore(
    useShallow((s) => ({
      isApartmentLocked: s.isApartmentLocked,
      editTarget: s.editTarget,
      apartmentNumber: s.apartmentNumber,
      entrance: s.entrance,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      egrn: s.egrn,
      text: s.text,
      rating: s.rating,
      setField: s.setField,
      setRating: s.setRating,
      close: s.close,
      reset: s.reset,
    })),
  )
  const createMutation = useCreateReviewMutation()
  const updateMutation = useUpdateReviewMutation()
  const captcha = useCaptcha()

  const { editTarget } = form
  const isEditing = editTarget !== null
  const mutation = isEditing ? updateMutation : createMutation
  const address = editTarget?.address ?? house?.address ?? ''

  const handleUnauthorized = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized()
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const captchaResult = await captcha.getToken()
    if (!captchaResult.ok) return

    const { apartmentNumber, entrance, periodFrom, periodTo, egrn, text, rating } =
      useReviewFormStore.getState()

    // Кнопка отправки заблокирована без оценки, но состояние читается заново —
    // сузить тип надо и здесь
    if (rating === null) return

    if (editTarget) {
      updateMutation.mutate(
        {
          reviewId: editTarget.reviewId,
          text,
          rating,
          periodFrom: periodFrom || undefined,
          periodTo: periodTo || undefined,
          captchaToken: captchaResult.token,
        },
        { onSuccess: () => form.reset(), onError: handleUnauthorized },
      )
      return
    }

    if (!house) return

    createMutation.mutate(
      {
        address: house.address,
        lat: house.lat,
        lon: house.lon,
        apartmentNumber,
        entrance,
        egrn,
        text,
        rating,
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        captchaToken: captchaResult.token,
      },
      {
        onSuccess: (created) => {
          form.reset()
          onCreated({ id: created.apartmentId, number: apartmentNumber, entrance })
        },
        onError: handleUnauthorized,
      },
    )
  }

  const isBusy = captcha.isRunning || mutation.isPending || form.rating === null

  return (
    <div className="modal-overlay" onClick={form.close}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h2>{isEditing ? 'Изменить отзыв' : 'Добавить отзыв'}</h2>
          <button type="button" className="modal__close" onClick={form.close} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <form className="modal__body" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Адрес</span>
            <input value={address} readOnly />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Квартира</span>
              <input
                value={form.apartmentNumber}
                onChange={(event) => form.setField('apartmentNumber', event.target.value)}
                placeholder="120"
                maxLength={20}
                required
                disabled={form.isApartmentLocked}
              />
            </label>
            <label className="field">
              <span className="field__label">Подъезд</span>
              <input
                value={form.entrance}
                onChange={(event) => form.setField('entrance', event.target.value)}
                placeholder="7"
                maxLength={20}
                required
                disabled={form.isApartmentLocked}
              />
            </label>
          </div>

          <div className="field">
            <span className="field__label">Период съёма</span>
            {/* Месяц и год: точный день съезда никто не помнит, а лишняя
                точность в публичном отзыве только помогает опознать жильца */}
            <div className="field-row">
              <input
                type="month"
                value={form.periodFrom}
                onChange={(event) => form.setField('periodFrom', event.target.value)}
                aria-label="Начало периода съёма"
              />
              <span className="field-row__dash">—</span>
              <input
                type="month"
                value={form.periodTo}
                onChange={(event) => form.setField('periodTo', event.target.value)}
                aria-label="Конец периода съёма"
              />
            </div>
          </div>

          {/* Кадастровый номер подтверждает право на первый отзыв о квартире
              и при правке не меняется — поэтому в режиме правки поля нет */}
          {!isEditing && (
            <label className="field">
              <span className="field__label">Кадастровый номер из выписки ЕГРН</span>
              <EgrnInput
                value={form.egrn}
                onChange={(egrn) => form.setField('egrn', egrn)}
                required
              />
            </label>
          )}

          <div className="field">
            <span className="field__label">Оценка</span>
            <RatingInput value={form.rating} onChange={form.setRating} />
          </div>

          <label className="field">
            <span className="field__label">Ваш отзыв</span>
            <textarea
              value={form.text}
              onChange={(event) => form.setField('text', event.target.value)}
              placeholder="Введите текст"
              rows={6}
              minLength={10}
              maxLength={TEXT_MAX_LENGTH}
              required
            />
            {/* Лимит жёсткий, поэтому он должен быть виден до, а не после отправки */}
            <span className="field__counter">
              {form.text.length} / {TEXT_MAX_LENGTH}
            </span>
          </label>

          {isEditing && (
            <p className="panel-note">
              После правки отзыв снова уйдёт на проверку и до её окончания будет скрыт.
            </p>
          )}
          {captcha.isDisabled && (
            <p className="panel-note -error">
              Капча выключена: не задан <code>VITE_SMARTCAPTCHA_CLIENT_KEY</code>. Отзыв
              отправляется без проверки.
            </p>
          )}
          <div className="captcha-slot" ref={captcha.containerRef} />
          {captcha.errorMessage && <p className="form-error">{captcha.errorMessage}</p>}
          {mutation.error && !(mutation.error instanceof ApiError && mutation.error.status === 401) && (
            <p className="form-error">{mutation.error.message}</p>
          )}

          <button type="submit" className="btn-primary" disabled={isBusy}>
            {captcha.isRunning
              ? 'Подтвердите, что вы не робот'
              : mutation.isPending
                ? 'Отправляем…'
                : 'Отправить на проверку'}
          </button>
        </form>
      </div>
    </div>
  )
}
