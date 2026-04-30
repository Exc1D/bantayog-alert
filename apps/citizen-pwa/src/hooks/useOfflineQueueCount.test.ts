/* eslint-disable @typescript-eslint/no-unsafe-return */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockList = vi.fn()

vi.mock('../services/draft-store', () => ({
  draftStore: { list: () => mockList() },
}))

import { useOfflineQueueCount } from './useOfflineQueueCount'

describe('useOfflineQueueCount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockList.mockResolvedValue([])
  })

  it('returns 0 when no pending drafts', async () => {
    mockList.mockResolvedValue([{ syncState: 'synced', id: '1' }])
    const { result } = renderHook(() => useOfflineQueueCount())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe(0)
  })

  it('counts local_only and syncing drafts', async () => {
    mockList.mockResolvedValue([
      { syncState: 'local_only', id: '1' },
      { syncState: 'syncing', id: '2' },
      { syncState: 'synced', id: '3' },
    ])
    const { result } = renderHook(() => useOfflineQueueCount())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe(2)
  })
})
