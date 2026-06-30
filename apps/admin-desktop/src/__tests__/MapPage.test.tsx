import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import MapPage from '../pages/MapPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import {
  renderWithMemoryRouter,
  resetWindowSyncContextMock,
  type WindowSyncMessage,
} from '../test-utils'

vi.mock('../app/firebase', async () =>
  (await import('../test-utils')).createAdminFirebaseModuleMock(),
)

vi.mock('../hooks/useFirestoreListeners', async () => {
  const { createMapFirestoreListeners } = await import('../test-utils')
  return { useFirestoreListeners: () => createMapFirestoreListeners([], []) }
})

vi.mock('../hooks/useUrlSync', () => ({
  useUrlSync: vi.fn(),
}))

const syncCtl = vi.hoisted(() => ({
  handler: null as ((msg: WindowSyncMessage) => void) | null,
}))

const mockWindowSyncContext = vi.hoisted(() => ({
  sendSync: vi.fn<(msg: WindowSyncMessage) => void>(),
  subscribe: vi
    .fn<(handler: (msg: WindowSyncMessage) => void) => () => void>()
    .mockReturnValue(() => undefined),
}))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => mockWindowSyncContext,
}))

function captureWindowSyncHandler() {
  mockWindowSyncContext.subscribe.mockImplementation((handler) => {
    syncCtl.handler = handler
    return () => undefined
  })
}

async function renderMapPage() {
  await act(async () => {
    renderWithMemoryRouter(<MapPage />)
    await Promise.resolve()
  })
}

describe('MapPage', () => {
  beforeEach(() => {
    captureWindowSyncHandler()
  })

  afterEach(() => {
    syncCtl.handler = null
    resetWindowSyncContextMock(mockWindowSyncContext)
    act(() => {
      useCommandCenterStore.setState({ selectedMunicipalityId: null, selectedReportId: null })
    })
  })

  it('renders map controls', async () => {
    await renderMapPage()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active Only' })).toBeInTheDocument()
  })

  it('N6 receiver: cross-window select:municipality message selects municipality in store', async () => {
    useCommandCenterStore.setState({ selectedMunicipalityId: null })
    await renderMapPage()
    act(() => {
      syncCtl.handler?.({
        type: 'select:municipality',
        municipalityId: 'daet',
        source: 'dashboard',
      })
    })
    expect(useCommandCenterStore.getState().selectedMunicipalityId).toBe('daet')
  })
})
