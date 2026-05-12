import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMunicipalityContact, DEFAULT_CONTACT } from '../useMunicipalityContact'

let mockUnsubscribe = vi.fn()
let mockOnSnapshotCallback: ((snap: unknown) => void) | null = null
let mockOnSnapshotError: ((err: Error) => void) | null = null

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, onNext, onError) => {
    mockOnSnapshotCallback = onNext as (snap: unknown) => void
    mockOnSnapshotError = onError as (err: Error) => void
    return mockUnsubscribe
  }),
}))

vi.mock('../../services/firebase.js', () => ({
  db: vi.fn(() => ({})),
  hasFirebaseConfig: vi.fn(() => true),
}))

import { onSnapshot } from 'firebase/firestore'

describe('useMunicipalityContact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUnsubscribe = vi.fn()
    mockOnSnapshotCallback = null
    mockOnSnapshotError = null
  })

  it('returns default contact when municipalityId is undefined', () => {
    const { result } = renderHook(() => useMunicipalityContact(undefined))
    expect(result.current).toEqual(DEFAULT_CONTACT)
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('returns default contact initially, then updates from snapshot', () => {
    const { result } = renderHook(() => useMunicipalityContact('daet'))

    // Should start with default while loading
    expect(result.current).toEqual(DEFAULT_CONTACT)

    // Simulate snapshot response with custom contact
    act(() => {
      mockOnSnapshotCallback?.({
        exists: () => true,
        data: () => ({
          mdrrmoLabel: 'Daet MDRRMO',
          mdrrmoHotline: '(054) 721-1216',
        }),
      })
    })

    expect(result.current).toEqual({
      label: 'Daet MDRRMO',
      hotline: '(054) 721-1216',
    })
  })

  it('falls back to default contact when snapshot errors', () => {
    const { result } = renderHook(() => useMunicipalityContact('daet'))

    expect(result.current).toEqual(DEFAULT_CONTACT)

    act(() => {
      mockOnSnapshotError?.(new Error('snapshot failed'))
    })

    expect(result.current).toEqual(DEFAULT_CONTACT)
  })

  it('falls back to label-based contact when municipality doc lacks mdrrmo fields', () => {
    const { result } = renderHook(() => useMunicipalityContact('mercedes'))

    act(() => {
      mockOnSnapshotCallback?.({
        exists: () => true,
        data: () => ({
          label: 'Mercedes',
        }),
      })
    })

    expect(result.current).toEqual({
      label: 'Mercedes MDRRMO',
      hotline: DEFAULT_CONTACT.hotline,
    })
  })

  it('falls back to DEFAULT_CONTACT.hotline when mdrrmoHotline is missing', () => {
    const { result } = renderHook(() => useMunicipalityContact('vinzons'))

    act(() => {
      mockOnSnapshotCallback?.({
        exists: () => true,
        data: () => ({
          mdrrmoLabel: 'Vinzons MDRRMO',
        }),
      })
    })

    expect(result.current).toEqual({
      label: 'Vinzons MDRRMO',
      hotline: DEFAULT_CONTACT.hotline,
    })
  })
})
