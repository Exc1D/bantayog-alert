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
})
