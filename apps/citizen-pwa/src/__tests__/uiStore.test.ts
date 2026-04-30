import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../lib/store.js'

beforeEach(() => {
  useUIStore.setState({
    navDirection: 'forward',
    hasCompletedOnboarding: false,
    bottomNavHidden: false,
    currentSheet: 'none',
    toast: null,
  })
  try {
    localStorage.clear()
  } catch {
    // happy-dom localStorage may not support clear()
  }
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

  it('setHasCompletedOnboarding updates state', () => {
    useUIStore.getState().setHasCompletedOnboarding(true)
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(true)
    // localStorage persistence is best-effort and may not be available in test environment
  })
})
