import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { WindowSyncProvider } from '../providers/WindowSyncProvider'
import { useWindowSync } from '../hooks/useWindowSync'
import type { SyncMessage } from '../stores/commandCenterStore'

interface MockBC {
  onmessage: ((ev: MessageEvent<SyncMessage>) => void) | null
  postMessage: (msg: SyncMessage) => void
  close: () => void
  emit: (msg: SyncMessage) => void
}

let lastBc: MockBC | null = null

describe('useWindowSync', () => {
  beforeEach(() => {
    lastBc = null
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        onmessage: ((ev: MessageEvent<SyncMessage>) => void) | null = null
        postMessage = vi.fn()
        close = vi.fn()
        constructor() {
          const bc = this as unknown as MockBC
          bc.emit = (msg: SyncMessage) => {
            this.onmessage?.({ data: msg } as MessageEvent<SyncMessage>)
          }
          lastBc = bc
        }
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
    const msg: SyncMessage = {
      type: 'select:report',
      reportId: 'r1',
      source: 'dashboard',
    }
    act(() => {
      result.current.sendSync(msg)
    })
    expect(lastBc?.postMessage).toHaveBeenCalledWith(msg)
  })

  it('routes incoming messages to the latest onMessage without re-subscribing', () => {
    const handlerA = vi.fn()
    const handlerB = vi.fn()
    const msg: SyncMessage = { type: 'select:report', reportId: 'r1', source: 'map' }

    const { rerender } = renderHook(
      ({ onMessage }: { onMessage: (m: SyncMessage) => void }) => useWindowSync(onMessage),
      {
        wrapper: WindowSyncProvider,
        initialProps: { onMessage: handlerA },
      },
    )

    act(() => {
      lastBc?.emit(msg)
    })
    expect(handlerA).toHaveBeenCalledWith(msg)
    expect(handlerB).not.toHaveBeenCalled()

    // Re-render with a new handler identity. The subscribe effect must NOT
    // re-run; the ref update should redirect future messages to handlerB.
    rerender({ onMessage: handlerB })
    handlerA.mockClear()

    act(() => {
      lastBc?.emit(msg)
    })
    expect(handlerB).toHaveBeenCalledWith(msg)
    expect(handlerA).not.toHaveBeenCalled()
  })

  it('drops BroadcastChannel payloads that are not valid SyncMessages', () => {
    const handler = vi.fn()
    renderHook(() => useWindowSync(handler), { wrapper: WindowSyncProvider })

    // Simulate a peer tab posting arbitrary garbage on the same channel.
    act(() => {
      lastBc?.emit({ type: 'unknown', foo: 'bar' } as unknown as SyncMessage)
    })
    act(() => {
      lastBc?.emit({ type: 'select:report', reportId: 123 } as unknown as SyncMessage)
    })
    act(() => {
      lastBc?.emit(null as unknown as SyncMessage)
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('drops storage-fallback envelopes with malformed payloads', () => {
    const handler = vi.fn()
    renderHook(() => useWindowSync(handler), { wrapper: WindowSyncProvider })

    const dispatch = (newValue: string | null) => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'bantayog-sync-fallback',
          newValue,
        }),
      )
    }

    act(() => {
      dispatch('not-json{')
    })
    act(() => {
      dispatch(JSON.stringify({ data: { type: 'unknown' }, timestamp: Date.now() }))
    })
    act(() => {
      dispatch(JSON.stringify({ data: 'not-an-object', timestamp: Date.now() }))
    })
    act(() => {
      // Missing timestamp number.
      dispatch(JSON.stringify({ data: { type: 'select:report', reportId: 'r1', source: 'map' } }))
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards storage-fallback envelopes when the payload validates', () => {
    const handler = vi.fn()
    renderHook(() => useWindowSync(handler), { wrapper: WindowSyncProvider })

    const msg: SyncMessage = { type: 'select:report', reportId: 'r9', source: 'dashboard' }
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'bantayog-sync-fallback',
          newValue: JSON.stringify({ data: msg, timestamp: Date.now() }),
        }),
      )
    })

    expect(handler).toHaveBeenCalledWith(msg)
  })
})
