import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/model/auth.store'
import { useReviewFormStore } from './review-form.store'
import type { ReviewFormPrefill } from './review-form.store'

/**
 * Открыть форму отзыва — с проверкой входа. Без токена запоминаем намерение
 * и открываем модалку входа; как только токен появится (в этом же рендере
 * или позже — после подтверждения на телефоне/почте), форма откроется сама
 * с тем же prefill. Общее для MapPage и HousePage: обе позволяют оставить
 * отзыв не будучи вошедшим.
 */
export function useOpenReviewForm(): (prefill: ReviewFormPrefill) => void {
  const token = useAuthStore((s) => s.token)
  const openAuthModal = useAuthStore((s) => s.openModal)
  const openForm = useReviewFormStore((s) => s.open)

  // Намерение «открыть форму после входа»; undefined — намерения нет
  const [pendingPrefill, setPendingPrefill] = useState<ReviewFormPrefill | undefined>(undefined)

  useEffect(() => {
    if (token && pendingPrefill !== undefined) {
      openForm(pendingPrefill)
      setPendingPrefill(undefined)
    }
  }, [token, pendingPrefill, openForm])

  return (prefill) => {
    if (!token) {
      setPendingPrefill(prefill)
      openAuthModal()
      return
    }
    openForm(prefill)
  }
}
