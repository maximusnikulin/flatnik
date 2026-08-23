import { create } from 'zustand'
import type { MyReview } from '@flatnik/shared'
import { clearDraft, draftKey, loadDraft, saveDraft } from './review-draft-storage'
import type { ReviewDraft } from './review-draft-storage'

/** Поля черновика, редактируемые из инпутов формы */
export type ReviewFormField =
  | 'apartmentNumber'
  | 'entrance'
  | 'periodFrom'
  | 'periodTo'
  | 'egrn'
  | 'regRecord'
  | 'text'

export interface ReviewFormPrefill {
  /** Адрес дома: он же основа ключа, под которым лежит черновик */
  address: string
  /** Квартира известна заранее — форму открыли из её панели */
  apartment?: { apartmentNumber: string; entrance: string }
}

/** Правка существующего отзыва: квартира и адрес известны из него самого */
export interface ReviewEditTarget {
  reviewId: string
  address: string
}

interface ReviewFormState {
  isOpen: boolean
  /** Открыто из панели квартиры — номер и подъезд заблокированы */
  isApartmentLocked: boolean
  /** Правится свой отзыв; null — создаётся новый */
  editTarget: ReviewEditTarget | null
  /**
   * Ключ черновика в localStorage; null — сохранять нечего (правка отзыва
   * или форма ещё не открывалась). Фиксируется при открытии и не меняется:
   * иначе черновик прыгал бы между ключами, пока человек печатает номер квартиры.
   */
  draftKey: string | null
  apartmentNumber: string
  entrance: string
  periodFrom: string
  periodTo: string
  /** Тип подтверждения права: кадастровый номер или рег. запись */
  ownershipProofType: 'egrn' | 'regRecord'
  egrn: string
  /** Регистрационная запись права — альтернатива кадастровому номеру */
  regRecord: string
  text: string
  /** Оценка 1–5; null — пользователь ещё не выбрал, отправка заблокирована */
  rating: number | null
  open: (prefill: ReviewFormPrefill) => void
  /** Правка своего отзыва: черновик заполняется его текущим содержимым */
  openEdit: (review: MyReview) => void
  setField: (field: ReviewFormField, value: string) => void
  /** Переключатель типа подтверждения права */
  setOwnershipProofType: (type: 'egrn' | 'regRecord') => void
  /** Оценка живёт отдельно от setField: там значение всегда строка */
  setRating: (rating: number) => void
  /** Закрыть, сохранив черновик (например, поверх открылась модалка входа) */
  close: () => void
  /** Очистить после успешной отправки */
  reset: () => void
}

const emptyDraft = {
  apartmentNumber: '',
  entrance: '',
  periodFrom: '',
  periodTo: '',
  ownershipProofType: 'egrn' as const,
  egrn: '',
  regRecord: '',
  text: '',
  rating: null,
}

/** Из состояния стора — то, что уходит в localStorage */
function toDraft(state: ReviewFormState): ReviewDraft {
  return {
    apartmentNumber: state.apartmentNumber,
    entrance: state.entrance,
    periodFrom: state.periodFrom,
    periodTo: state.periodTo,
    ownershipProofType: state.ownershipProofType,
    egrn: state.egrn,
    regRecord: state.regRecord,
    text: state.text,
    rating: state.rating,
  }
}

export const useReviewFormStore = create<ReviewFormState>((set, get) => {
  /**
   * Пишем на каждое изменение поля. Дебаунс тут не нужен: черновик — сотни
   * байт, а сложности он добавил бы заметно. Правка отзыва не сохраняется —
   * её содержимое приходит с сервера, и копия в браузере только разъезжалась бы
   * с тем, что на самом деле в отзыве.
   */
  const persist = () => {
    const state = get()
    if (state.draftKey) saveDraft(state.draftKey, toDraft(state))
  }

  return {
    isOpen: false,
    isApartmentLocked: false,
    editTarget: null,
    draftKey: null,
    ...emptyDraft,
    open: (prefill) => {
      const { address, apartment } = prefill
      const key = draftKey(
        address,
        apartment && { entrance: apartment.entrance, number: apartment.apartmentNumber },
      )
      const saved = loadDraft(key)
      set({
        isOpen: true,
        isApartmentLocked: apartment !== undefined,
        editTarget: null,
        draftKey: key,
        ...emptyDraft,
        ...saved,
        // Квартира из панели важнее сохранённой: черновик мог остаться от того,
        // как человек набирал номер руками в форме, открытой из панели дома
        ...(apartment ?? {}),
      })
    },
    openEdit: (review) =>
      set({
        isOpen: true,
        isApartmentLocked: true,
        editTarget: { reviewId: review.id, address: review.address },
        draftKey: null,
        apartmentNumber: review.apartmentNumber,
        entrance: review.entrance,
        periodFrom: review.periodFrom ?? '',
        periodTo: review.periodTo ?? '',
        // Запись регистрации права не правится и в PATCH не уходит; поле в форме показывается пустым
        ownershipProofType: 'egrn' as const,
        egrn: '',
        regRecord: '',
        text: review.text,
        rating: review.rating,
      }),
    setField: (field, value) => {
      set((state) => ({ ...state, [field]: value }))
      persist()
    },
    setOwnershipProofType: (type) => {
      set({ ownershipProofType: type })
      persist()
    },
    setRating: (rating) => {
      set({ rating })
      persist()
    },
    // Закрытие как раз и должно сохранять черновик — хранилище не трогаем
    close: () => set({ isOpen: false }),
    reset: () => {
      const { draftKey: key } = get()
      if (key) clearDraft(key)
      set({
        isOpen: false,
        isApartmentLocked: false,
        editTarget: null,
        draftKey: null,
        ...emptyDraft,
      })
    },
  }
})
