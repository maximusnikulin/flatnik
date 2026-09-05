import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { ApiError } from '../../../shared/api/fetcher'
import { meQuery } from '../../auth/api/auth.api'
import { EmailConfirmField } from './EmailConfirmField'
import { useReviewFormStore } from '../model/review-form.store'
import { useCreateReviewMutation } from '../api/create-review'
import { useUpdateReviewMutation } from '../api/update-review'
import { useCaptcha } from '../../../shared/lib/use-captcha'
import { RegRecordInput } from '../../../shared/ui/RegRecordInput'
import { InfoTooltip } from '../../../shared/ui/InfoTooltip'
import { MonthInput } from '../../../shared/ui/MonthInput'
import { RatingInput } from '../../../shared/ui/RatingInput'
import { MIN_MONTH, currentMonth } from '../../../shared/lib/month'
import { REVIEW_GUIDELINES_URL, SUPPORT_EMAIL } from '../../../shared/lib/contacts'

/** Столько же стоит в CreateReviewDto и UpdateReviewDto на бэкенде */
const TEXT_MAX_LENGTH = 3000

interface ReviewFormModalProps {
  /** Дом для нового отзыва; в режиме правки адрес берётся из самого отзыва */
  house: { address: string; lat: number; lon: number } | null
  /** Отзыв создан — открыть панель квартиры */
  onCreated: (apartment: { id: string; number: string; entrance: string }) => void
  /** Токен истёк или отозван — нужно войти заново, черновик сохраняется */
  onUnauthorized: () => void
}

/** Модалка отзыва: адрес, квартира, период, запись регистрации права, текст.
 *  В режиме правки меняются только текст и период — остальное определяет уже созданный отзыв */
export function ReviewFormModal({ house, onCreated, onUnauthorized }: ReviewFormModalProps) {
  const form = useReviewFormStore(
    useShallow((s) => ({
      isApartmentLocked: s.isApartmentLocked,
      editTarget: s.editTarget,
      apartmentNumber: s.apartmentNumber,
      entrance: s.entrance,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      regRecord: s.regRecord,
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

  // Решение модератора уходит письмом, поэтому у автора должна быть
  // подтверждённая почта. Модалка открывается только вошедшему, так что
  // профиль здесь уже в кеше
  const me = useQuery(meQuery(true))
  const email = me.data?.email ?? null
  // Отзыв подписывается ником, а не именем или телефоном. Человек должен
  // видеть это до отправки, а не узнавать из опубликованного отзыва
  const nickname = me.data?.nickname ?? null

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

    const { apartmentNumber, entrance, periodFrom, periodTo, regRecord, text, rating } =
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
        regRecord: regRecord || undefined,
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

  // Правка почты не требует: отзыв уже создан, значит она тогда и подтверждалась
  const needsEmail = !isEditing && email === null
  const isBusy = captcha.isRunning || mutation.isPending || form.rating === null || needsEmail
  const maxMonth = currentMonth()

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
          <div className="field">
            <span className="field__label">Адрес</span>
            {/* div вместо input: адрес может быть длинным, а input обрезает
                текст в одну строку и не растягивается под содержимое */}
            <div className="field__readonly">{address}</div>
          </div>

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
              {/* Правило «конец не раньше начала» выражено границами полей:
                  так его проверяет сама форма, ещё до отправки на сервер */}
              <MonthInput
                value={form.periodFrom}
                onChange={(month) => form.setField('periodFrom', month)}
                min={MIN_MONTH}
                max={form.periodTo || maxMonth}
                aria-label="Начало периода съёма"
              />
              <span className="field-row__dash">—</span>
              <MonthInput
                value={form.periodTo}
                onChange={(month) => form.setField('periodTo', month)}
                min={form.periodFrom || MIN_MONTH}
                max={maxMonth}
                aria-label="Конец периода съёма"
              />
            </div>
          </div>

          {/* Запись регистрации права подтверждает владение квартирой.
              При правке не меняется — поля нет в режиме редактирования */}
          {!isEditing && (
            <label className="field">
              <span className="field__label field__label--with-tooltip">
                Запись регистрации права. Указывается в договоре аренды.
                <InfoTooltip>
                  {`77:01 — округ и район (по 2 цифры)\n0001011 — квартал (6 или 7 цифр, 7-я необязательна)\n1101 — объект (1–10 цифр)\n— разделитель\n77 — регион (2 цифры)\n/011/ — отдел Росреестра (3 цифры)\n2011 — год (4 цифры)\n-1 — порядковый номер записи (1–7 цифр)\n\nУказывается в договоре на аренду.\n\nЕсли не указать — отзыв будет помечен как с низким доверием.`}
                </InfoTooltip>
              </span>
              <RegRecordInput
                value={form.regRecord}
                onChange={(v) => form.setField('regRecord', v)}
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

          {/* Почта уже подтверждена — просто напоминаем, куда придёт ответ.
              Иначе просим подтвердить: без неё отправку не разблокируем */}
          {!isEditing && email !== null && (
            <p className="panel-note">Статус отзыва отправим на почту <strong>{email}</strong>.</p>
          )}
          {needsEmail && <EmailConfirmField />}

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

          {nickname !== null && (
            <p className="panel-note">Отзыв будет размещён от имени <strong>{nickname}</strong>.</p>
          )}

          <p className="panel-note">
            Если что-то не работает или есть замечания —{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="panel-note__link">пишите нам: {SUPPORT_EMAIL}</a>.
          </p>

          {/* Согласие даётся самим действием, как в AuthModal: текст вплотную
              к кнопке и называет её словами. Документ открывается в новой
              вкладке, чтобы не потерять заполненную форму */}
          <p className="panel-note">
            Нажимая «Отправить на проверку», вы соглашаетесь с{' '}
            <a href={REVIEW_GUIDELINES_URL} target="_blank" rel="noopener noreferrer">
              правилами написания отзывов
            </a>
            .
          </p>

          <button type="submit" className="btn-primary" disabled={isBusy}>
            {captcha.isRunning
              ? 'Подтвердите, что вы не робот'
              : mutation.isPending
                ? 'Отправляем…'
                : needsEmail
                  ? 'Сначала подтвердите почту'
                  : 'Отправить на проверку'}
          </button>
        </form>
      </div>
    </div>
  )
}
