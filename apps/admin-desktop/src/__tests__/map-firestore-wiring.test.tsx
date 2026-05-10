import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r1',
        type: 'FLOOD',
        severity: 'HIGH',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'PENDING',
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
    render(<MapPage />)
    expect(screen.getByText('Provincial Map — Camarines Norte')).toBeInTheDocument()
  })

  it('shows TriagePanel when report selected', () => {
    useCommandCenterStore.setState({ selectedReportId: 'r1' })
    render(<MapPage />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
