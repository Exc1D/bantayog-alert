import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import {
  BrowserRouterWrapper,
  calmRows,
  activeRows,
  surgeRows,
  defaultResponders,
  defaultMetrics,
  defaultFirestoreListeners,
} from '../test-utils'

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

vi.mock('../app/firebase', async () =>
  (await import('../test-utils')).createAdminFirebaseModuleMock(),
)

vi.mock('../providers/WindowSyncProvider', async () =>
  (await import('../test-utils')).createWindowSyncProviderModuleMock(),
)

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@bantayog/shared-ui', async () =>
  (await import('../test-utils')).createProvincialSuperadminAuthModuleMock(),
)

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
    })
    mockUseDispatchLifecycle.mockReturnValue({ rows: activeRows, loading: false, error: null })
    mockUseResponderFleet.mockReturnValue({
      responders: defaultResponders,
      loading: false,
      error: null,
    })
    mockUseOpsMetrics.mockReturnValue(defaultMetrics)
    mockUseFirestoreListeners.mockReturnValue(defaultFirestoreListeners)
  })

  it('transitions from calm to active when incidents appear', () => {
    // Start calm
    mockUseDispatchLifecycle.mockReturnValue({ rows: calmRows, loading: false, error: null })
    const { rerender } = render(<DashboardPage />, { wrapper: BrowserRouterWrapper })

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('CALM')

    // Switch to active
    mockUseDispatchLifecycle.mockReturnValue({ rows: activeRows, loading: false, error: null })
    rerender(<DashboardPage />)

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('ACTIVE')
  })

  it('hides escalation queue in calm mode', () => {
    mockUseDispatchLifecycle.mockReturnValue({ rows: calmRows, loading: false, error: null })
    render(<DashboardPage />, { wrapper: BrowserRouterWrapper })

    expect(screen.queryByLabelText('Escalation queue')).not.toBeInTheDocument()
  })

  it('hides charts and municipal table in surge mode', () => {
    mockUseDispatchLifecycle.mockReturnValue({ rows: surgeRows, loading: false, error: null })
    render(<DashboardPage />, { wrapper: BrowserRouterWrapper })

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('SURGE')
    expect(screen.queryByLabelText('Dispatch volume last 24 hours')).not.toBeInTheDocument()
    expect(screen.queryByText('Municipality')).not.toBeInTheDocument()
  })
})
