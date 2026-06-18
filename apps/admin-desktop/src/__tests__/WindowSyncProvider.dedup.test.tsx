import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import { WindowSyncProvider, useWindowSyncContext } from '../providers/WindowSyncProvider'
import { createStorageSyncEvent } from '../test-utils'
import type { WindowSyncMessage } from '../stores/commandCenterStore'

function Consumer({ onMsg }: { onMsg: (m: WindowSyncMessage) => void }) {
  const { subscribe } = useWindowSyncContext()
  useEffect(() => subscribe(onMsg), [subscribe, onMsg])
  return null
}

describe('WindowSyncProvider dedup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers the same message id only once', () => {
    const seen = vi.fn()
    const { rerender } = render(
      <WindowSyncProvider>
        <Consumer onMsg={seen} />
      </WindowSyncProvider>,
    )
    rerender(
      <WindowSyncProvider>
        <Consumer onMsg={seen} />
      </WindowSyncProvider>,
    )

    // Simulate both BroadcastChannel and storage delivering the same message.
    const msg: WindowSyncMessage = {
      type: 'select:report',
      reportId: 'r1',
      source: 'dashboard',
      id: 'dedup-1',
    }
    act(() => {
      window.dispatchEvent(createStorageSyncEvent(msg))
      window.dispatchEvent(createStorageSyncEvent(msg))
    })

    expect(seen).toHaveBeenCalledTimes(1)
  })
})
