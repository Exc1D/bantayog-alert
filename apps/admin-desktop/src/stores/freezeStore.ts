import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface FreezeState {
  isFrozen: boolean
  frozenAt: number | null
  freeze: () => void
  unfreeze: () => void
  toggle: () => void
}

export const createFreezeStore = () =>
  create<FreezeState>()(
    devtools(
      persist(
        (set) => ({
          isFrozen: false,
          frozenAt: null,
          freeze: () => set({ isFrozen: true, frozenAt: Date.now() }),
          unfreeze: () => set({ isFrozen: false, frozenAt: null }),
          toggle: () =>
            set((state) => ({
              isFrozen: !state.isFrozen,
              frozenAt: !state.isFrozen ? Date.now() : null,
            })),
        }),
        { name: 'bantayog-freeze-display' },
      ),
    ),
  )

// Singleton instance for app
export const useFreezeStore = createFreezeStore()
