/**
 * Tests for municipality drill-down (3c-21):
 *   N7 — Dashboard row click uses ?municipalityId= (not ?municipality=)
 *   N6 sender — Dashboard row click broadcasts select:municipality to cross-window listeners
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import { renderWithMemoryRouter, defaultResponders, defaultMetrics, makeRow } from '../test-utils'

const mockNavigate = vi.fn()
// Hoisted so the WindowSyncProvider mock factory can reference it
const mockSendSync = vi.hoisted(() => vi.fn())

// Required: DashboardPage → CommandHeader → EditHotlineModal → db (eager SDK init)
vi.mock('../app/firebase', () => ({
  db: {} as never,
  getFirestoreInstance: () => ({}) as never,
  auth: {} as never,
  functions: {} as never,
  rtdb: {} as never,
  firebaseApp: {} as never,
}))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: mockSendSync,
    subscribe: vi.fn().mockReturnValue((): void => {
      return
    }),
  }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    loading: false,
    claims: { role: 'provincial_superadmin' },
  }),
}))

vi.mock('../services/callables', () => ({
  callables: { verifyReport: vi.fn() },
}))

// Use ONE pending dispatch (no needs_admin) → activeCount=1, stalledCount=0 → mode='active'
// This ensures MunicipalPerformanceTable is rendered (mode !== 'calm' && mode !== 'surge')
vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: () => ({
    rows: [makeRow({ dispatchId: 'd1', reportId: 'r1', status: 'pending' })],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: () => ({
    responders: defaultResponders,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: () => defaultMetrics,
}))

// Reports with two municipalities so the performance table has real rows
vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
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
  }),
}))

describe('DashboardPage municipality drill-down (3c-21)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockSendSync.mockClear()
  })

  it('N7: municipality row click navigates with ?municipalityId= (not ?municipality=)', () => {
    renderWithMemoryRouter(<DashboardPage />)
    // MunicipalPerformanceTable renders the municipality name as plain text inside <td>
    // Filter to <td> elements to avoid matching "Daet" in the report command queue's <p> nodes
    const daetCells = screen.getAllByText('Daet').filter((el) => el.tagName.toLowerCase() === 'td')
    expect(daetCells.length).toBeGreaterThan(0)
    fireEvent.click(daetCells[0]!)
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('municipalityId=Daet'))
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('?municipality=Daet'))
  })

  it('N6 sender: municipality row click broadcasts select:municipality to other windows', () => {
    renderWithMemoryRouter(<DashboardPage />)
    const daetCells = screen.getAllByText('Daet').filter((el) => el.tagName.toLowerCase() === 'td')
    expect(daetCells.length).toBeGreaterThan(0)
    fireEvent.click(daetCells[0]!)
    expect(mockSendSync).toHaveBeenCalledWith({
      type: 'select:municipality',
      municipalityId: 'Daet',
      source: 'dashboard',
    })
  })
})
