import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import { renderWithMemoryRouter, makeRow, defaultRows } from '../test-utils'

const mockNavigate = vi.fn()
const mockVerifyReport = vi.hoisted(() =>
  vi.fn(({ reportId }: { reportId: string }) =>
    Promise.resolve({
      status: reportId === 'r-new' ? 'awaiting_verify' : 'verified',
      reportId,
    }),
  ),
)

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
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@bantayog/shared-ui', async () =>
  (await import('../test-utils')).createProvincialSuperadminAuthModuleMock(),
)

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
  },
}))

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: () => ({
    rows: defaultRows.concat(
      makeRow({
        dispatchId: 'd2',
        reportId: 'r2',
        status: 'needs_admin',
        responderName: 'B',
        responderAgency: 'MDRRMO',
      }),
    ),
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useResponderFleet', async () =>
  (await import('../test-utils')).createResponderFleetHookModuleMock(),
)

vi.mock('../hooks/useOpsMetrics', async () =>
  (await import('../test-utils')).createOpsMetricsHookModuleMock(),
)

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    reports: [
      {
        id: 'r-new',
        type: 'flood',
        severity: 'medium',
        municipality: 'Daet',
        barangay: 'Bagasbas',
        createdAt: Date.now(),
        description: 'Rising creek',
        status: 'new',
      },
      {
        id: 'r-awaiting',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Centro',
        createdAt: Date.now(),
        description: 'Flooded road',
        status: 'awaiting_verify',
      },
      {
        id: 'r-verified',
        type: 'fire',
        severity: 'critical',
        municipality: 'Basud',
        barangay: 'Poblacion',
        createdAt: Date.now(),
        description: 'House fire',
        status: 'verified',
      },
    ],
    loading: false,
    error: null,
    alerts: [],
  }),
}))

describe('DashboardPage ops redesign', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockVerifyReport.mockClear()
  })

  it('renders StatusBar metrics', () => {
    renderWithMemoryRouter(<DashboardPage />)
    // StatusBar primary metrics in the situation strip
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('avg response')).toBeInTheDocument()
    // Stalled count shown in expanded section
    expect(screen.getByTestId('statusbar-stalled')).toBeInTheDocument()
  })

  it('renders an actionable report command queue', () => {
    renderWithMemoryRouter(<DashboardPage />)
    expect(screen.getByRole('heading', { name: /Report command queue/i })).toBeInTheDocument()
    expect(screen.getByText('Rising creek')).toBeInTheDocument()
    expect(screen.getByText('Flooded road')).toBeInTheDocument()
    expect(screen.getByText('House fire')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send report r-new to review/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verify report r-awaiting/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Dispatch report r-verified on map/i }),
    ).toBeInTheDocument()
  })

  it('sends new reports to review from the dashboard queue', async () => {
    renderWithMemoryRouter(<DashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /Send report r-new to review/i }))

    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-new',
          idempotencyKey: expect.any(String),
        }),
      )
    })
    expect(await screen.findByText('Report sent to review')).toBeInTheDocument()
  })

  it('verifies awaiting reports from the dashboard queue', async () => {
    renderWithMemoryRouter(<DashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /Verify report r-awaiting/i }))

    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-awaiting',
          idempotencyKey: expect.any(String),
        }),
      )
    })
    expect(await screen.findByText('Report verified')).toBeInTheDocument()
  })

  it('opens verified reports on the map for dispatch', () => {
    renderWithMemoryRouter(<DashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /Dispatch report r-verified on map/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/map?reportId=r-verified')
  })

  it('has sr-only h1', () => {
    renderWithMemoryRouter(<DashboardPage />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('sr-only')
    expect(h1).toHaveTextContent('Operations Dashboard')
  })

  it('renders Declare Alert button', () => {
    renderWithMemoryRouter(<DashboardPage />)
    expect(screen.getByRole('button', { name: /Declare Alert/i })).toBeInTheDocument()
  })

  it('navigates to /dispatches on D key', () => {
    renderWithMemoryRouter(<DashboardPage />)
    fireEvent.keyDown(window, { key: 'd' })
    expect(mockNavigate).toHaveBeenCalledWith('/dispatches')
  })

  it('navigates to /feed on F key', () => {
    renderWithMemoryRouter(<DashboardPage />)
    fireEvent.keyDown(window, { key: 'f' })
    expect(mockNavigate).toHaveBeenCalledWith('/feed')
  })

  it('focuses first re-dispatch button on R key', () => {
    renderWithMemoryRouter(<DashboardPage />)
    const button = screen.getByRole('button', { name: /^Re-dispatch/ })
    const focusSpy = vi.spyOn(button, 'focus')
    fireEvent.keyDown(window, { key: 'r' })
    expect(focusSpy).toHaveBeenCalled()
  })
})
