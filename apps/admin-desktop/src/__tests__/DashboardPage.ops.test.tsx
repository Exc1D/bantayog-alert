import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

const mockNavigate = vi.fn()
const mockVerifyReport = vi.hoisted(() =>
  vi.fn(({ reportId }: { reportId: string }) =>
    Promise.resolve({
      status: reportId === 'r-new' ? 'awaiting_verify' : 'verified',
      reportId,
    }),
  ),
)

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

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
  callables: {
    verifyReport: mockVerifyReport,
  },
}))

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: () => ({
    rows: [
      {
        dispatchId: 'd1',
        reportId: 'r1',
        status: 'pending',
        responderName: 'A',
        responderAgency: 'BFP',
        dispatchedAt: Date.now(),
        deadlineAt: Date.now() + 300000,
        escalationCount: 0,
        fcmResult: null,
        fcmWarnings: null,
        timeline: [],
      },
      {
        dispatchId: 'd2',
        reportId: 'r2',
        status: 'needs_admin',
        responderName: 'B',
        responderAgency: 'MDRRMO',
        dispatchedAt: Date.now(),
        deadlineAt: Date.now() + 300000,
        escalationCount: 2,
        fcmResult: null,
        fcmWarnings: null,
        timeline: [],
      },
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: () => ({
    responders: [
      {
        uid: 'u1',
        displayName: 'Responder A',
        availabilityStatus: 'available',
        lastActivityAt: Date.now(),
        onlineStatus: 'online' as const,
      },
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: () => ({
    metrics: {
      avgAcceptSeconds: 120,
      fcmSuccessRate: 0.95,
      totalDispatches: 10,
      acceptedCount: 8,
      declinedCount: 1,
      escalatedCount: 1,
      needsAdminCount: 0,
    },
    loading: false,
    error: null,
  }),
}))

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
    renderWithRouter(<DashboardPage />)
    // StatusBar primary metrics in the situation strip
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('avg response')).toBeInTheDocument()
    // Stalled count shown in expanded section
    expect(screen.getByTestId('statusbar-stalled')).toBeInTheDocument()
  })

  it('renders an actionable report command queue', () => {
    renderWithRouter(<DashboardPage />)
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
    renderWithRouter(<DashboardPage />)
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
    renderWithRouter(<DashboardPage />)
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
    renderWithRouter(<DashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /Dispatch report r-verified on map/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/map?reportId=r-verified')
  })

  it('has sr-only h1', () => {
    renderWithRouter(<DashboardPage />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('sr-only')
    expect(h1).toHaveTextContent('Operations Dashboard')
  })

  it('renders Declare Alert button', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByRole('button', { name: /Declare Alert/i })).toBeInTheDocument()
  })

  it('navigates to /dispatches on D key', () => {
    renderWithRouter(<DashboardPage />)
    fireEvent.keyDown(window, { key: 'd' })
    expect(mockNavigate).toHaveBeenCalledWith('/dispatches')
  })

  it('navigates to /feed on F key', () => {
    renderWithRouter(<DashboardPage />)
    fireEvent.keyDown(window, { key: 'f' })
    expect(mockNavigate).toHaveBeenCalledWith('/feed')
  })

  it('focuses first re-dispatch button on R key', () => {
    renderWithRouter(<DashboardPage />)
    const button = screen.getByRole('button', { name: /^Re-dispatch/ })
    const focusSpy = vi.spyOn(button, 'focus')
    fireEvent.keyDown(window, { key: 'r' })
    expect(focusSpy).toHaveBeenCalled()
  })
})
