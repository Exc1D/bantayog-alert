import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import { WindowSyncProvider, useWindowSyncContext } from '../providers/WindowSyncProvider'
import type { SyncMessage } from '../stores/commandCenterStore'

function Consumer({ onMsg }: { onMsg: (m: SyncMessage) => void }) {
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
    const msg: SyncMessage = {
      type: 'select:report',
      reportId: 'r1',
      source: 'dashboard',
      id: 'dedup-1',
    }
    act(() => {
      window.dispatchEvent(
        (() => {
          const e = new Event('storage')
          Object.defineProperty(e, 'key', { value: 'bantayog-sync-fallback' })
          Object.defineProperty(e, 'newValue', {
            value: JSON.stringify({ data: msg, timestamp: Date.now() }),
          })
          return e
        })(),
      )
      window.dispatchEvent(
        (() => {
          const e = new Event('storage')
          Object.defineProperty(e, 'key', { value: 'bantayog-sync-fallback' })
          Object.defineProperty(e, 'newValue', {
            value: JSON.stringify({ data: msg, timestamp: Date.now() }),
          })
          return e
        })(),
      )
    })

    expect(seen).toHaveBeenCalledTimes(1)
  })
})
