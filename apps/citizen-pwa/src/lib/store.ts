import { create } from 'zustand'

interface UIState {
  bottomNavHidden: boolean
  currentSheet: 'none' | 'submit-reveal'
  toast: { id: string; message: string; type: 'success' | 'error' | 'info' } | null
  navDirection: 'forward' | 'backward'
  hasCompletedOnboarding: boolean
  hideBottomNav: () => void
  showBottomNav: () => void
  openSheet: (sheet: 'submit-reveal') => void
  closeSheet: () => void
  setToast: (toast: UIState['toast']) => void
  clearToast: () => void
  setNavDirection: (d: 'forward' | 'backward') => void
  setHasCompletedOnboarding: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  bottomNavHidden: false,
  currentSheet: 'none',
  toast: null,
  navDirection: 'forward',
  hasCompletedOnboarding:
    typeof window !== 'undefined'
      ? (() => {
          try {
            return localStorage.getItem('bantayog_onboarding_complete') === 'true'
          } catch {
            return false
          }
        })()
      : false,

  hideBottomNav: () => set({ bottomNavHidden: true }),
  showBottomNav: () => set({ bottomNavHidden: false }),

  openSheet: (sheet) => set({ currentSheet: sheet }),
  closeSheet: () => set({ currentSheet: 'none' }),

  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),

  setNavDirection: (navDirection) => set({ navDirection }),

  setHasCompletedOnboarding: (v) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bantayog_onboarding_complete', v ? 'true' : 'false')
      } catch {
        // ignore
      }
    }
    set({ hasCompletedOnboarding: v })
  },
}))