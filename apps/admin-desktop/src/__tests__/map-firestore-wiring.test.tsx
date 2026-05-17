import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

const mockDispatchResponder = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ dispatchId: 'd1', status: 'ASSIGNED', reportId: 'r1' }),
)

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: vi.fn().mockResolvedValue({}),
    rejectReport: vi.fn().mockResolvedValue({}),
    dispatchResponder: mockDispatchResponder,
  },
}))

const mockSendSync = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() =>
  vi.fn().mockReturnValue(() => {
    /* noop */
  }),
)

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: mockSendSync,
    subscribe: mockSubscribe,
  }),
}))

const mockUseFirestoreListeners = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r1',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'new',
        description: 'Water rising',
        reporterName: 'Juan',
        reporterPhone: '0917xxx',
        latitude: 14.1,
        longitude: 122.9,
        updatedAt: '',
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [['uid1', { displayName: 'Responder A', agency: 'BFP' }]],
  }),
)

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: mockUseFirestoreListeners,
}))

describe('MapPage Firestore wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCommandCenterStore.setState({
      selectedMunicipalityId: null,
      selectedReportId: null,
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

  it('renders map with reports from Firestore', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Provincial Map — Camarines Norte')).toBeInTheDocument()
    // Confirm useFirestoreListeners is invoked and wired to the page
    expect(mockUseFirestoreListeners).toHaveBeenCalledWith(
      expect.objectContaining({ windowType: 'map' }),
    )
  })

  it('shows TriagePanel when report selected', () => {
    useCommandCenterStore.setState({ selectedReportId: 'r1' })
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not show reject or dispatch controls for a newly submitted report', () => {
    useCommandCenterStore.setState({ selectedReportId: 'r1' })
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('Water rising')
    expect(screen.getByRole('button', { name: 'Advance to review' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dispatch Responder' })).not.toBeInTheDocument()
  })
})
