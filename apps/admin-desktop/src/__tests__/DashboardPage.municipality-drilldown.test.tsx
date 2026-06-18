/**
 * Tests for municipality drill-down (3c-21):
 *   N7 — Dashboard row click uses ?municipalityId= (not ?municipality=)
 *   N6 sender — Dashboard row click broadcasts select:municipality to cross-window listeners
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import {
  renderWithMemoryRouter,
  resetWindowSyncContextMock,
  type WindowSyncMessage,
} from '../test-utils'

const mockNavigate = vi.fn()
const mockWindowSyncContext = vi.hoisted(() => ({
  sendSync: vi.fn<(msg: WindowSyncMessage) => void>(),
  subscribe: vi
    .fn<(handler: (msg: WindowSyncMessage) => void) => () => void>()
    .mockReturnValue(() => undefined),
}))

vi.mock('../app/firebase', async () =>
  (await import('../test-utils')).createAdminFirebaseModuleMock(),
)

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => mockWindowSyncContext,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@bantayog/shared-ui', async () =>
  (await import('../test-utils')).createProvincialSuperadminAuthModuleMock(),
)

vi.mock('../services/callables', () => ({
  callables: { verifyReport: vi.fn() },
}))

// Use ONE pending dispatch (no needs_admin) → activeCount=1, stalledCount=0 → mode='active'
// This ensures MunicipalPerformanceTable is rendered (mode !== 'calm' && mode !== 'surge')
vi.mock('../hooks/useDispatchLifecycle', async () => {
  const { createDispatchLifecycleHookModuleMock, makeRow } = await import('../test-utils')
  return createDispatchLifecycleHookModuleMock([
    makeRow({ dispatchId: 'd1', reportId: 'r1', status: 'pending' }),
  ])
})

vi.mock('../hooks/useResponderFleet', async () =>
  (await import('../test-utils')).createResponderFleetHookModuleMock(),
)

vi.mock('../hooks/useOpsMetrics', async () =>
  (await import('../test-utils')).createOpsMetricsHookModuleMock(),
)

// Reports with two municipalities so the performance table has real rows
vi.mock('../hooks/useFirestoreListeners', async () => {
  const { createFirestoreListenersHookModuleMock } = await import('../test-utils')
  return createFirestoreListenersHookModuleMock({
    reports: [
      {
        id: 'r-active',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Bagasbas',
        createdAt: Date.now(),
        description: 'Active flooding in Daet',
        status: 'awaiting_verify',
      },
      {
        id: 'r-active-2',
        type: 'fire',
        severity: 'critical',
        municipality: 'Basud',
        barangay: 'Poblacion',
        createdAt: Date.now(),
        description: 'House fire in Basud',
        status: 'verified',
      },
    ],
    loading: false,
    error: null,
    alerts: [],
  })
})

function clickDaetMunicipalityRow() {
  const daetCells = screen.getAllByText('Daet').filter((el) => el.tagName.toLowerCase() === 'td')
  expect(daetCells.length).toBeGreaterThan(0)
  fireEvent.click(daetCells[0]!)
}

describe('DashboardPage municipality drill-down (3c-21)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    resetWindowSyncContextMock(mockWindowSyncContext)
  })

  it('N7: municipality row click navigates with ?municipalityId= (not ?municipality=)', () => {
    renderWithMemoryRouter(<DashboardPage />)
    clickDaetMunicipalityRow()
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('municipalityId=Daet'))
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('?municipality=Daet'))
  })

  it('N6 sender: municipality row click broadcasts select:municipality to other windows', () => {
    renderWithMemoryRouter(<DashboardPage />)
    clickDaetMunicipalityRow()
    expect(mockWindowSyncContext.sendSync).toHaveBeenCalledWith({
      type: 'select:municipality',
      municipalityId: 'Daet',
      source: 'dashboard',
    } satisfies WindowSyncMessage)
  })
})
