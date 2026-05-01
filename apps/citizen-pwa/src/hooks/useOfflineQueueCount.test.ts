/* eslint-disable @typescript-eslint/no-unsafe-return */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockList = vi.fn()

vi.mock('../services/draft-store', () => ({
  draftStore: { list: () => mockList() },
}))

vi.mock('./useOnlineStatus', () => ({
  useOnlineStatus: () => ({ navigatorOnline: true }),
}))

import { useOfflineQueueCount } from './useOfflineQueueCount'

describe('useOfflineQueueCount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockList.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns queueCount 0 when all synced', async () => {
    mockList.mockResolvedValue([{ syncState: 'synced', id: '1' }])
    const { result } = renderHook(() => useOfflineQueueCount())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.queueCount).toBe(0)
    expect(result.current.isOnline).toBe(true)
  })

  it('counts non-synced drafts', async () => {
    mockList.mockResolvedValue([
      { syncState: 'local_only', id: '1' },
      { syncState: 'syncing', id: '2' },
      { syncState: 'synced', id: '3' },
    ])
    const { result } = renderHook(() => useOfflineQueueCount())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.queueCount).toBe(2)
  })
})
