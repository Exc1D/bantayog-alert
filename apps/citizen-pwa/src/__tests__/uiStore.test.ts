import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../lib/store.js'

let storage: Record<string, string> = {}

beforeEach(() => {
  useUIStore.setState({
    navDirection: 'forward',
    hasCompletedOnboarding: false,
    bottomNavHidden: false,
    currentSheet: 'none',
    toast: null,
  })
  storage = {}
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        storage[key] = undefined as unknown as string
      },
      clear: () => {
        storage = {}
      },
    },
    configurable: true,
  })
})

describe('useUIStore', () => {
  it('defaults navDirection to forward', () => {
    expect(useUIStore.getState().navDirection).toBe('forward')
  })

  it('setNavDirection updates navDirection', () => {
    useUIStore.getState().setNavDirection('backward')
    expect(useUIStore.getState().navDirection).toBe('backward')
  })

  it('defaults hasCompletedOnboarding to false when localStorage is empty', () => {
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(false)
  })

  it('setHasCompletedOnboarding updates state and persists', () => {
    useUIStore.getState().setHasCompletedOnboarding(true)
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(true)
    expect(storage.bantayog_onboarding_complete).toBe('true')
  })

  describe('bottom nav', () => {
    it('hideBottomNav sets bottomNavHidden to true', () => {
      useUIStore.getState().hideBottomNav()
      expect(useUIStore.getState().bottomNavHidden).toBe(true)
    })

    it('showBottomNav sets bottomNavHidden to false', () => {
      useUIStore.getState().hideBottomNav()
      expect(useUIStore.getState().bottomNavHidden).toBe(true)
      useUIStore.getState().showBottomNav()
      expect(useUIStore.getState().bottomNavHidden).toBe(false)
    })
  })

  describe('sheet management', () => {
    it('openSheet sets currentSheet', () => {
      useUIStore.getState().openSheet('submit-reveal')
      expect(useUIStore.getState().currentSheet).toBe('submit-reveal')
    })

    it('closeSheet resets currentSheet to none', () => {
      useUIStore.getState().openSheet('submit-reveal')
      expect(useUIStore.getState().currentSheet).toBe('submit-reveal')
      useUIStore.getState().closeSheet()
      expect(useUIStore.getState().currentSheet).toBe('none')
    })
  })

  describe('toast management', () => {
    it('setToast sets the toast object', () => {
      const toast = { id: 't1', message: 'Saved!', type: 'success' as const }
      useUIStore.getState().setToast(toast)
      expect(useUIStore.getState().toast).toEqual(toast)
    })

    it('clearToast sets toast to null', () => {
      useUIStore.getState().setToast({ id: 't1', message: 'Saved!', type: 'success' })
      useUIStore.getState().clearToast()
      expect(useUIStore.getState().toast).toBeNull()
    })
  })
})
