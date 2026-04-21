import { create } from 'zustand'

interface UIState {
  bottomNavHidden: boolean
  currentSheet: 'none' | 'submit-reveal'
  toast: { id: string; message: string; type: 'success' | 'error' | 'info' } | null
  hideBottomNav: () => void
  showBottomNav: () => void
  openSheet: (sheet: 'submit-reveal') => void
  closeSheet: () => void
  setToast: (toast: UIState['toast']) => void
  clearToast: () => void
}

export const useUIStore = create<UIState>((set) => ({
  bottomNavHidden: false,
  currentSheet: 'none',
  toast: null,

  hideBottomNav: () => set({ bottomNavHidden: true }),
  showBottomNav: () => set({ bottomNavHidden: false }),

  openSheet: (sheet) => set({ currentSheet: sheet }),
  closeSheet: () => set({ currentSheet: 'none' }),

  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}))