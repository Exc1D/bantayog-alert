import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFieldModeStore } from '../hooks/useFieldModeStore.js'

const { mockOnSnapshot, mockHttpsCallable, mockHttpsCallableFn } = vi.hoisted(() => {
  const httpsCallableFn = vi.fn()
  return {
    mockOnSnapshot: vi.fn(),
    mockHttpsCallable: vi.fn(() => httpsCallableFn),
    mockHttpsCallableFn: httpsCallableFn,
  }
})

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: mockOnSnapshot,
  getFirestore: vi.fn(() => ({})),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
  getFunctions: vi.fn(() => ({})),
}))

const ts = 1700000000000 // fixed timestamp for test determinism

beforeEach(() => {
  mockOnSnapshot.mockReset()
  mockHttpsCallable.mockClear()
  mockHttpsCallableFn.mockReset()
  mockHttpsCallableFn.mockResolvedValue({ data: { status: 'exited' } })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useFieldModeStore', () => {
  it('shows isActive true when session snapshot has isActive true', () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        exists: () => true,
        data: () => ({ isActive: true, expiresAt: ts + 3600000 }),
      })
      return vi.fn()
    })
    const { result } = renderHook(() => useFieldModeStore('uid-1'))
    expect(result.current.isActive).toBe(true)
  })

  it('shows isActive false when no session exists', () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => false, data: () => undefined })
      return vi.fn()
    })
    const { result } = renderHook(() => useFieldModeStore('uid-1'))
    expect(result.current.isActive).toBe(false)
  })

  it('calls exitFieldMode when session expires', () => {
    vi.useFakeTimers()
    const expiredAt = Date.now() - 1000
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        exists: () => true,
        data: () => ({ isActive: true, expiresAt: expiredAt }),
      })
      return vi.fn()
    })
    renderHook(() => useFieldModeStore('uid-1'))
    act(() => {
      vi.advanceTimersByTime(65000)
    })
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'exitFieldMode')
  })
})
