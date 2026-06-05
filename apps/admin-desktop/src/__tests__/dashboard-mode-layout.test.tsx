import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

const mockUseDispatchLifecycle = vi.hoisted(() => vi.fn())
const mockUseResponderFleet = vi.hoisted(() => vi.fn())
const mockUseOpsMetrics = vi.hoisted(() => vi.fn())
const mockUseFirestoreListeners = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: mockUseDispatchLifecycle,
}))

vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: mockUseResponderFleet,
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: mockUseOpsMetrics,
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: mockUseFirestoreListeners,
}))

vi.mock('../app/firebase', () => ({
  db: {} as never,
  getFirestoreInstance: () => ({}) as never,
  auth: {} as never,
  functions: {} as never,
  rtdb: {} as never,
  firebaseApp: {} as never,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    loading: false,
    claims: { role: 'provincial_superadmin' },
  }),
}))

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    dispatchId: overrides.dispatchId ?? 'd1',
    reportId: overrides.reportId ?? 'rep-12345-abcde',
    status: overrides.status ?? 'pending',
    responderName: overrides.responderName ?? 'Juan Dela Cruz',
    responderAgency: overrides.responderAgency ?? 'BFP',
    dispatchedAt: overrides.dispatchedAt ?? Date.now(),
    deadlineAt: overrides.deadlineAt ?? Date.now() + 3600000,
    escalationCount: overrides.escalationCount ?? 0,
    fcmResult: overrides.fcmResult ?? null,
    fcmWarnings: overrides.fcmWarnings ?? null,
    timeline: overrides.timeline ?? [],
    assignedTo: overrides.assignedTo ?? { uid: 'r1' },
    previouslyNotifiedResponderUids: overrides.previouslyNotifiedResponderUids ?? [],
  }
}

const calmRows: ReturnType<typeof makeRow>[] = []
const activeRows = [makeRow({ status: 'pending' })]
const surgeRows = Array.from({ length: 21 }, (_, i) =>
  makeRow({ dispatchId: `d${String(i)}`, status: 'pending' }),
)

const defaultResponders = [
  {
    uid: 'r1',
    displayName: 'Alice',
    availabilityStatus: 'available' as const,
    lastActivityAt: Date.now(),
    onlineStatus: 'online' as const,
  },
]

const defaultMetrics = {
  avgAcceptSeconds: 42,
  fcmSuccessRate: 0.95,
  totalDispatches: 100,
  acceptedCount: 80,
  declinedCount: 10,
  escalatedCount: 5,
  needsAdminCount: 5,
}

describe('DashboardPage mode derivation and layout', () => {
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
    mockUseDispatchLifecycle.mockReturnValue({ rows: activeRows, loading: false, error: null })
    mockUseResponderFleet.mockReturnValue({
      responders: defaultResponders,
      loading: false,
      error: null,
    })
    mockUseOpsMetrics.mockReturnValue({
      metrics: defaultMetrics,
      loading: false,
      error: null,
    })
    mockUseFirestoreListeners.mockReturnValue({
      reports: [],
      loading: false,
      error: null,
    })
  })

  it('transitions from calm to active when incidents appear', () => {
    // Start calm
    mockUseDispatchLifecycle.mockReturnValue({ rows: calmRows, loading: false, error: null })
    const { rerender } = render(<DashboardPage />, { wrapper: BrowserRouter })

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('CALM')

    // Switch to active
    mockUseDispatchLifecycle.mockReturnValue({ rows: activeRows, loading: false, error: null })
    rerender(<DashboardPage />)

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('ACTIVE')
  })

  it('hides escalation queue in calm mode', () => {
    mockUseDispatchLifecycle.mockReturnValue({ rows: calmRows, loading: false, error: null })
    render(<DashboardPage />, { wrapper: BrowserRouter })

    expect(screen.queryByLabelText('Escalation queue')).not.toBeInTheDocument()
  })

  it('hides charts and municipal table in surge mode', () => {
    mockUseDispatchLifecycle.mockReturnValue({ rows: surgeRows, loading: false, error: null })
    render(<DashboardPage />, { wrapper: BrowserRouter })

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('SURGE')
    expect(screen.queryByLabelText('Dispatch volume last 24 hours')).not.toBeInTheDocument()
    expect(screen.queryByText('Municipality')).not.toBeInTheDocument()
  })
})
