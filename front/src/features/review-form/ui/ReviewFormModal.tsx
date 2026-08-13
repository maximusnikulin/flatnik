import { useShallow } from 'zustand/react/shallow'
import { ApiError } from '../../../shared/api/fetcher'
import { useReviewFormStore } from '../model/review-form.store'
import { useCreateReviewMutation } from '../api/create-review'
import { useCaptcha } from '../../../shared/lib/use-captcha'

interface ReviewFormModalProps {
  address: string
  lat: number
  lon: number
  /** Отзыв создан — открыть панель квартиры */
  onCreated: (apartment: { id: string; number: string; entrance: string }) => void
  /** Токен истёк или отозван — нужно войти заново, черновик сохраняется */
  onUnauthorized: () => void
}

/** Модалка «Добавить отзыв» — по макету: адрес, квартира, период, ЕГРН, текст */
export function ReviewFormModal({ address, lat, lon, onCreated, onUnauthorized }: ReviewFormModalProps) {
  const form = useReviewFormStore(
    useShallow((s) => ({
      isApartmentLocked: s.isApartmentLocked,
      apartmentNumber: s.apartmentNumber,
      entrance: s.entrance,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      egrn: s.egrn,
      text: s.text,
      setField: s.setField,
      close: s.close,
      reset: s.reset,
    })),
  )
  const mutation = useCreateReviewMutation()
  const captcha = useCaptcha()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const captchaResult = await captcha.getToken()
    if (!captchaResult.ok) return

    const { apartmentNumber, entrance, periodFrom, periodTo, egrn, text } =
      useReviewFormStore.getState()
    mutation.mutate(
      {
        address,
        lat,
        lon,
        apartmentNumber,
        entrance,
        egrn,
        text,
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        captchaToken: captchaResult.token,
      },
      {
        onSuccess: (created) => {
          form.reset()
          onCreated({ id: created.apartmentId, number: apartmentNumber, entrance })
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401) {
            onUnauthorized()
          }
        },
      },
    )
  }

  const isBusy = captcha.isRunning || mutation.isPending

  return (
    <div className="modal-overlay" onClick={form.close}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h2>Добавить отзыв</h2>
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
            <div className="field-row">
              <input
                type="date"
                value={form.periodFrom}
                onChange={(event) => form.setField('periodFrom', event.target.value)}
                aria-label="Начало периода съёма"
              />
              <span className="field-row__dash">—</span>
              <input
                type="date"
                value={form.periodTo}
                onChange={(event) => form.setField('periodTo', event.target.value)}
                aria-label="Конец периода съёма"
              />
            </div>
          </div>

          <label className="field">
            <span className="field__label">Кадастровый номер из выписки ЕГРН</span>
            <input
              value={form.egrn}
              onChange={(event) => form.setField('egrn', event.target.value)}
              placeholder="77:01:0001075:1234"
              pattern="[0-9:]{5,40}"
              title="Цифры и двоеточия, например 77:01:0001075:1234"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Ваш отзыв</span>
            <textarea
              value={form.text}
              onChange={(event) => form.setField('text', event.target.value)}
              placeholder="Введите текст"
              rows={6}
              minLength={10}
              maxLength={10000}
              required
            />
          </label>

          {captcha.errorMessage && <p className="form-error">{captcha.errorMessage}</p>}
          {mutation.error && !(mutation.error instanceof ApiError && mutation.error.status === 401) && (
            <p className="form-error">{mutation.error.message}</p>
          )}

          <button type="submit" className="btn-primary" disabled={isBusy}>
            {isBusy ? 'Отправляем…' : 'Отправить на проверку'}
          </button>
        </form>
      </div>
    </div>
  )
}
