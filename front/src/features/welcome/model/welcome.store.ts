import { create } from 'zustand'

const KEY = 'flatnik:welcomed'

function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

interface WelcomeStore {
  isOpen: boolean
  dismiss: () => void
}

export const useWelcomeStore = create<WelcomeStore>((set) => ({
  isOpen: !hasSeenWelcome(),
  dismiss: () => {
    try {
      localStorage.setItem(KEY, 'true')
    } catch {
      // private mode — ignore
    }
    set({ isOpen: false })
  },
}))
