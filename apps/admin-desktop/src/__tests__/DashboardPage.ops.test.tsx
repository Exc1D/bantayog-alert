import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

const mockNavigate = vi.fn()

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
        lastSeenAt: Date.now(),
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
        id: 'rpt1',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Centro',
        createdAt: Date.now(),
        status: 'verified',
      },
    ],
    loading: false,
    error: null,
    alerts: [],
  }),
}))

describe('DashboardPage ops redesign', () => {
  it('renders KPI cards', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByText('Active Now')).toBeInTheDocument()
    expect(screen.getByText('Stalled')).toBeInTheDocument()
  })

  it('does not render triage queue', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.queryByText('Triage Queue')).not.toBeInTheDocument()
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
