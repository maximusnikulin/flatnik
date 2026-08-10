import { create } from 'zustand'

/** Поля черновика, редактируемые из инпутов формы */
export type ReviewFormField =
  | 'apartmentNumber'
  | 'entrance'
  | 'periodFrom'
  | 'periodTo'
  | 'egrn'
  | 'text'
  | 'authorName'

export interface ReviewFormPrefill {
  apartmentNumber: string
  entrance: string
}

interface ReviewFormState {
  isOpen: boolean
  /** Открыто из панели квартиры — номер и подъезд заблокированы */
  isApartmentLocked: boolean
  apartmentNumber: string
  entrance: string
  periodFrom: string
  periodTo: string
  egrn: string
  text: string
  authorName: string
  open: (prefill?: ReviewFormPrefill) => void
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
  authorName: '',
}

export const useReviewFormStore = create<ReviewFormState>((set) => ({
  isOpen: false,
  isApartmentLocked: false,
  ...emptyDraft,
  open: (prefill) =>
    set((state) => ({
      ...state,
      isOpen: true,
      isApartmentLocked: prefill !== undefined,
      apartmentNumber: prefill?.apartmentNumber ?? state.apartmentNumber,
      entrance: prefill?.entrance ?? state.entrance,
    })),
  setField: (field, value) => set((state) => ({ ...state, [field]: value })),
  close: () => set({ isOpen: false }),
  reset: () => set({ isOpen: false, isApartmentLocked: false, ...emptyDraft }),
}))
