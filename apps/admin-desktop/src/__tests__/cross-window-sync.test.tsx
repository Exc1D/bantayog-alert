import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { WindowSyncProvider, useWindowSyncContext } from '../providers/WindowSyncProvider'

describe('Cross-window sync', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    useCommandCenterStore.setState({
      selectedReportId: null,
      selectedMunicipalityId: null,
      triageFilters: {},
      chartTimeRange: '7d',
      statusBarExpanded: false,
      statusBarExpandedOverride: null,
      mapBounds: null,
      activeOverlays: new Set(['all_incidents']),
      triagePanelOpen: false,
      lastSyncMessage: null,
      suppressNextBroadcast: false,
    })
  })

  it('broadcasts select:report via BroadcastChannel', async () => {
    const postMessage = vi.fn()
    function MockBroadcastChannel() {
      return { postMessage, close: vi.fn() }
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)

    function TestComponent() {
      const { sendSync } = useWindowSyncContext()
      return (
        <button
          onClick={() => {
            sendSync({
              type: 'select:report',
              reportId: 'r1',
              source: 'dashboard',
            })
          }}
        >
          Send
        </button>
      )
    }

    render(
      <WindowSyncProvider>
        <TestComponent />
      </WindowSyncProvider>,
    )

    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'select:report', reportId: 'r1' }),
      )
    })

    vi.unstubAllGlobals()
  })

  it('receives select:municipality and updates store', async () => {
    const listeners = new Set<(msg: unknown) => void>()
    function MockBroadcastChannel() {
      return {
        postMessage: vi.fn(),
        set onmessage(handler: (ev: { data: unknown }) => void) {
          listeners.add((msg) => {
            handler({ data: msg })
          })
        },
        close: vi.fn(),
      }
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)

    function Receiver() {
      const { subscribe } = useWindowSyncContext()
      const { selectMunicipality } = useCommandCenterStore()

      useEffect(() => {
        return subscribe((msg) => {
          if (msg.type === 'select:municipality') {
            selectMunicipality(msg.municipalityId)
          }
        })
      }, [subscribe, selectMunicipality])

      return null
    }

    render(
      <WindowSyncProvider>
        <Receiver />
      </WindowSyncProvider>,
    )

    await waitFor(() => {
      expect(listeners.size).toBeGreaterThan(0)
    })

    act(() => {
      listeners.forEach((fn) => {
        fn({
          type: 'select:municipality',
          municipalityId: 'm1',
          source: 'map',
        })
      })
    })

    expect(useCommandCenterStore.getState().selectedMunicipalityId).toBe('m1')

    vi.unstubAllGlobals()
  })

  it('falls back to localStorage when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)

    const setItemSpy = vi.fn()
    vi.stubGlobal('localStorage', {
      setItem: setItemSpy,
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })

    function TestComponent() {
      const { sendSync } = useWindowSyncContext()
      return (
        <button
          onClick={() => {
            sendSync({
              type: 'select:report',
              reportId: 'r2',
              source: 'map',
            })
          }}
        >
          Send
        </button>
      )
    }

    render(
      <WindowSyncProvider>
        <TestComponent />
      </WindowSyncProvider>,
    )

    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        'bantayog-sync-fallback',
        expect.stringContaining('"reportId":"r2"'),
      )
    })

    vi.unstubAllGlobals()
  })
})
