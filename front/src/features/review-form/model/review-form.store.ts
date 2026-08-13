import { create } from 'zustand'
import type { MyReview } from '@flatnik/shared'

/** Поля черновика, редактируемые из инпутов формы */
export type ReviewFormField =
  | 'apartmentNumber'
  | 'entrance'
  | 'periodFrom'
  | 'periodTo'
  | 'egrn'
  | 'text'

export interface ReviewFormPrefill {
  apartmentNumber: string
  entrance: string
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
  apartmentNumber: string
  entrance: string
  periodFrom: string
  periodTo: string
  egrn: string
  text: string
  open: (prefill?: ReviewFormPrefill) => void
  /** Правка своего отзыва: черновик заполняется его текущим содержимым */
  openEdit: (review: MyReview) => void
  setField: (field: ReviewFormField, value: string) => void
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
  egrn: '',
  text: '',
}

export const useReviewFormStore = create<ReviewFormState>((set) => ({
  isOpen: false,
  isApartmentLocked: false,
  editTarget: null,
  ...emptyDraft,
  open: (prefill) =>
    set((state) => ({
      ...state,
      isOpen: true,
      isApartmentLocked: prefill !== undefined,
      editTarget: null,
      apartmentNumber: prefill?.apartmentNumber ?? state.apartmentNumber,
      entrance: prefill?.entrance ?? state.entrance,
    })),
  openEdit: (review) =>
    set({
      isOpen: true,
      isApartmentLocked: true,
      editTarget: { reviewId: review.id, address: review.address },
      apartmentNumber: review.apartmentNumber,
      entrance: review.entrance,
      periodFrom: review.periodFrom ?? '',
      periodTo: review.periodTo ?? '',
      // ЕГРН не правится и в PATCH не уходит; поле в форме показывается пустым
      egrn: '',
      text: review.text,
    }),
  setField: (field, value) => set((state) => ({ ...state, [field]: value })),
  close: () => set({ isOpen: false }),
  reset: () => set({ isOpen: false, isApartmentLocked: false, editTarget: null, ...emptyDraft }),
}))
