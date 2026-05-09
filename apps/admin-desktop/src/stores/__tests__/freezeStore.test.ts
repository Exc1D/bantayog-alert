import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createFreezeStore } from '../freezeStore'

describe('Freeze Store', () => {
  // Mock localStorage for Zustand persist middleware
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete store[key]
      },
      clear: () => {
        store = {}
      },
      get length() {
        return Object.keys(store).length
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    }
  })()

  beforeEach(() => {
    // Set up localStorage mock
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  afterEach(() => {
    // Clean up: clear localStorage after each test
    localStorageMock.clear()
  })

  it('should initialize with unfrozen state', () => {
    const store = createFreezeStore()
    const state = store.getState()
    expect(state.isFrozen).toBe(false)
    expect(state.frozenAt).toBeNull()
  })

  it('should freeze and record timestamp', () => {
    const store = createFreezeStore()
    const beforeFreeze = Date.now()

    store.getState().freeze()

    const afterFreeze = Date.now()
    const state = store.getState()

    expect(state.isFrozen).toBe(true)
    expect(state.frozenAt).toBeGreaterThanOrEqual(beforeFreeze)
    expect(state.frozenAt).toBeLessThanOrEqual(afterFreeze)
  })

  it('should unfreeze and clear timestamp', () => {
    const store = createFreezeStore()

    store.getState().freeze()
    expect(store.getState().isFrozen).toBe(true)

    store.getState().unfreeze()
    const state = store.getState()

    expect(state.isFrozen).toBe(false)
    expect(state.frozenAt).toBeNull()
  })

  it('should toggle freeze state', () => {
    const store = createFreezeStore()

    store.getState().toggle()
    expect(store.getState().isFrozen).toBe(true)

    store.getState().toggle()
    expect(store.getState().isFrozen).toBe(false)
  })
})
