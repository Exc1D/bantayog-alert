import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const pushClientState = vi.hoisted(() => ({
  notificationTap: null as ((dispatchId: string) => void) | null,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))
vi.mock('./components/Shell', () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}))
vi.mock('./components/SosHoldButton', () => ({
  SosHoldButton: () => null,
}))
vi.mock('./pages/MapPage', () => ({
  MapPage: () => <div data-testid="map-page" />,
}))
vi.mock('./pages/FeedPage', () => ({
  FeedPage: () => <div data-testid="feed-page" />,
}))
vi.mock('./pages/AlertsPage', () => ({
  AlertsPage: () => <div data-testid="alerts-page" />,
}))
vi.mock('./pages/ProfilePage', () => ({
  ProfilePage: () => <div data-testid="profile-page" />,
}))
vi.mock('./pages/DispatchListPage', () => ({
  DispatchListPage: () => <div data-testid="dispatch-list" />,
}))
vi.mock('./pages/DispatchDetailPage', () => ({
  DispatchDetailPage: () => <div data-testid="dispatch-detail" />,
}))
vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page" />,
}))

vi.mock('./pages/DispatchHistoryPage', () => ({
  DispatchHistoryPage: () => <div data-testid="history-page" />,
}))
vi.mock('./pages/SosPage', () => ({
  SosPage: () => <div data-testid="sos-page" />,
}))
vi.mock('./pages/BackupRequestPage', () => ({
  BackupRequestPage: () => <div data-testid="backup-page" />,
}))
vi.mock('./pages/ResponderWitnessReportPage', () => ({
  ResponderWitnessReportPage: () => <div data-testid="witness-page" />,
}))
vi.mock('./pages/TotpGuard', () => ({
  TotpGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./pages/TotpEnrollmentPage', () => ({
  TotpEnrollmentPage: () => <div data-testid="totp-enroll-page" />,
}))
vi.mock('./services/push-client', () => ({
  subscribeForegroundPush: () => () => undefined,
  subscribeNotificationTap: (onTap: (dispatchId: string) => void) => {
    pushClientState.notificationTap = onTap
    return () => {
      pushClientState.notificationTap = null
    }
  },
}))

async function renderAt(pathname: string) {
  window.history.pushState({}, '', pathname)
  vi.resetModules()
  const { AppRouter } = await import('./routes')
  return render(<AppRouter />)
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
  pushClientState.notificationTap = null
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AppRouter', () => {
  it('renders DispatchListPage at / wrapped in Shell', async () => {
    await renderAt('/')
    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('dispatch-list')).toBeInTheDocument()
  })

  it('renders MapPage at /map wrapped in Shell', async () => {
    await renderAt('/map')
    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('map-page')).toBeInTheDocument()
  })

  it('renders FeedPage at /feed wrapped in Shell', async () => {
    await renderAt('/feed')
    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('feed-page')).toBeInTheDocument()
  })

  it('renders AlertsPage at /alerts wrapped in Shell', async () => {
    await renderAt('/alerts')
    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('alerts-page')).toBeInTheDocument()
  })

  it('renders ProfilePage at /profile wrapped in Shell', async () => {
    await renderAt('/profile')
    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('profile-page')).toBeInTheDocument()
  })

  it('renders DispatchDetailPage at /dispatches/:id outside Shell', async () => {
    await renderAt('/dispatches/disp-1')
    expect(screen.queryByTestId('shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('dispatch-detail')).toBeInTheDocument()
  })

  it('routes notification taps to dispatch detail', async () => {
    await renderAt('/')
    await waitFor(() => {
      expect(pushClientState.notificationTap).not.toBeNull()
    })

    act(() => {
      pushClientState.notificationTap?.('disp-99')
    })

    expect(screen.queryByTestId('shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('dispatch-detail')).toBeInTheDocument()
  })

  it('renders DispatchHistoryPage at /history outside Shell', async () => {
    await renderAt('/history')
    expect(screen.queryByTestId('shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('history-page')).toBeInTheDocument()
  })

  it('renders LoginPage at /login outside Shell', async () => {
    await renderAt('/login')
    expect(screen.queryByTestId('shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders TotpEnrollmentPage at /totp-enroll outside Shell', async () => {
    await renderAt('/totp-enroll')
    expect(screen.queryByTestId('shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('totp-enroll-page')).toBeInTheDocument()
  })
})
