import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { WindowSyncProvider } from '../providers/WindowSyncProvider'
import { useWindowSync } from '../hooks/useWindowSync'

describe('useWindowSync', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'BroadcastChannel',
      class MockBC {
        onmessage: ((ev: MessageEvent) => void) | null = null
        postMessage = vi.fn()
        close = vi.fn()
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a sync message', () => {
    const { result } = renderHook(() => useWindowSync(), {
      wrapper: WindowSyncProvider,
    })
    act(() => {
      result.current.sendSync({
        type: 'select:report',
        reportId: 'r1',
        source: 'dashboard',
      })
    })
    expect(result.current.sendSync).toBeDefined()
  })
})
