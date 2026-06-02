import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SituationUpdate } from '../services/situation-updates.js'

const { mockHasFirebaseConfig, mockSubscribeSituationUpdates, mockUnsubscribe } = vi.hoisted(
  () => ({
    mockHasFirebaseConfig: vi.fn().mockReturnValue(true),
    mockSubscribeSituationUpdates: vi.fn(),
    mockUnsubscribe: vi.fn(),
  }),
)

vi.mock('../services/firebase.js', () => ({
  hasFirebaseConfig: () => mockHasFirebaseConfig(),
}))

vi.mock('../services/situation-updates.js', () => ({
  subscribeSituationUpdates: (...args: unknown[]) => mockSubscribeSituationUpdates(...args),
}))

import { useSituationUpdates } from './useSituationUpdates.js'

const daetUpdate: SituationUpdate = {
  id: 'sit-1',
  authorUid: 'citizen-1',
  createdAt: 100,
  municipalityId: 'daet',
  municipalityLabel: 'Daet',
  barangayLabel: 'San Jose',
  hazardType: 'typhoon',
  condition: 'heavy_rain',
  body: 'Strong rain near the market.',
  visibility: 'public',
  reportedCount: 0,
}

const laboUpdate: SituationUpdate = {
  id: 'sit-2',
  authorUid: 'citizen-2',
  createdAt: 200,
  municipalityId: 'labo',
  municipalityLabel: 'Labo',
  barangayLabel: 'Talobatib',
  hazardType: 'flood',
  condition: 'flooding',
  body: 'Water is rising near the bridge.',
  visibility: 'public',
  reportedCount: 0,
}

describe('useSituationUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasFirebaseConfig.mockReturnValue(true)
    mockSubscribeSituationUpdates.mockImplementation(
      (onNext: (updates: SituationUpdate[]) => void) => {
        onNext([daetUpdate, laboUpdate])
        return mockUnsubscribe
      },
    )
  })

  it('filters updates by municipality', async () => {
    const { result } = renderHook(() => useSituationUpdates({ municipality: 'Daet' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.updates).toEqual([daetUpdate])
  })

  it('records when updates last arrived', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(12_345)
    const { result } = renderHook(() => useSituationUpdates({ municipality: '' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.lastUpdatedAt).toBe(12_345)
    nowSpy.mockRestore()
  })

  it('can retry after a subscription error', async () => {
    const unsubscribe = vi.fn()
    mockSubscribeSituationUpdates.mockImplementation(
      (_onNext: (updates: SituationUpdate[]) => void, onError: (err: unknown) => void) => {
        onError(new Error('offline'))
        return unsubscribe
      },
    )
    const { result } = renderHook(() => useSituationUpdates({ municipality: '' }))

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    act(() => {
      result.current.retry()
    })

    expect(mockSubscribeSituationUpdates).toHaveBeenCalledTimes(2)
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('returns empty state without subscribing when Firebase is not configured', async () => {
    mockHasFirebaseConfig.mockReturnValue(false)
    const { result } = renderHook(() => useSituationUpdates({ municipality: '' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.updates).toEqual([])
    expect(mockSubscribeSituationUpdates).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSituationUpdates({ municipality: '' }))

    act(() => {
      unmount()
    })

    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })
})
