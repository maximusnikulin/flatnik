import { create } from 'zustand'
import { getAuthToken, setAuthToken } from '../../../shared/api/token'

interface AuthState {
  /** JWT; дублируется в shared/api/token, откуда его читает fetcher */
  token: string | null
  isModalOpen: boolean
  setToken: (token: string | null) => void
  openModal: () => void
  closeModal: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getAuthToken(),
  isModalOpen: false,
  setToken: (token) => {
    setAuthToken(token)
    set({ token })
  },
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}))
