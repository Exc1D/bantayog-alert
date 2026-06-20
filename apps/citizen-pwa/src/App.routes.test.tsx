import '@testing-library/jest-dom/vitest'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const useMyActiveReportsMock = vi.hoisted(() => vi.fn())

vi.mock('./components/MapTab/index.js', () => ({
  MapTab: () => <div>Map tab</div>,
}))

vi.mock('./components/SubmitReportForm/index.js', () => ({
  SubmitReportForm: () => <div>Report form</div>,
}))

vi.mock('./components/LookupScreen.js', () => ({
  LookupScreen: () => <div>Lookup</div>,
}))

vi.mock('./components/FeedTab.js', () => ({
  FeedTab: () => <div>Feed tab</div>,
}))

vi.mock('./components/AlertsTab.js', () => ({
  AlertsTab: () => <div>Alerts tab</div>,
}))

vi.mock('./components/IncidentDetailPage.js', () => ({
  IncidentDetailPage: () => <div>Incident detail</div>,
}))

vi.mock('./pages/RegisterPage.js', () => ({
  RegisterPage: () => <div>Register page</div>,
}))

vi.mock('./pages/SettingsPage.js', () => ({
  SettingsPage: () => <div>Settings page</div>,
}))

vi.mock('./pages/SplashScreen.js', async () => {
  const { useEffect } = await import('react')
  return {
    SplashScreen: ({ onDone }: { onDone?: () => void }) => {
      useEffect(() => {
        onDone?.()
      }, [onDone])
      return null
    },
  }
})

vi.mock('./pages/Onboarding.js', () => ({
  Onboarding: () => <div>Onboarding</div>,
}))

vi.mock('./lib/store.js', () => ({
  useUIStore: (
    sel: (s: {
      hasCompletedOnboarding: boolean
      navDirection: string
      setNavDirection: () => void
    }) => unknown,
  ) => sel({ hasCompletedOnboarding: true, navDirection: 'forward', setNavDirection: vi.fn() }),
}))

vi.mock('./hooks/useOfflineQueueCount.js', () => ({
  useOfflineQueueCount: () => ({ isOnline: true, queueCount: 0 }),
}))

vi.mock('./hooks/useAlerts.js', () => ({
  useAlerts: () => ({ alerts: [], loading: false, error: null }),
}))

vi.mock('./hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: useMyActiveReportsMock,
}))

vi.mock('./hooks/useAlertReadState.js', () => ({
  useAlertReadState: () => ({
    markAsRead: vi.fn(),
    unreadCount: () => 0,
  }),
}))

vi.mock('./hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

vi.mock('./hooks/useResumeRegistration.js', () => ({
  useResumeRegistration: () => undefined,
}))

vi.mock('./services/wizard-snapshot.js', () => ({
  wizardSnapshot: {
    clear: () => Promise.resolve(),
    load: () => Promise.resolve(null),
  },
}))

async function renderAppAt(pathname: string) {
  window.history.pushState({}, '', pathname)
  vi.resetModules()
  const { App } = await import('./App.js')
  return render(<App />)
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
  useMyActiveReportsMock.mockReturnValue({
    reports: [],
    loading: false,
    status: 'ready',
    error: null,
    retry: vi.fn(),
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('App routes', () => {
  it('shows Home instead of Map at the index route', async () => {
    await renderAppAt('/')
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    expect(screen.getByTestId('home-tab')).toBeInTheDocument()
    expect(screen.queryByText('Map tab')).not.toBeInTheDocument()
  })

  it('keeps Alerts reachable from the Home header', async () => {
    await renderAppAt('/')
    fireEvent.click(screen.getByRole('button', { name: 'Open alerts' }))
    expect(await screen.findByText('Alerts tab')).toBeInTheDocument()
  })

  it('shows Map inside the shell at /map', async () => {
    await renderAppAt('/map')
    expect(screen.getByText('Map tab')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('exposes exactly Home, Map, Report, Feed, and Profile in the bottom nav', async () => {
    await renderAppAt('/')
    const navigation = screen.getByRole('navigation', { name: /main navigation/i })
    const labels = within(navigation)
      .getAllByRole('button')
      .map((button) => button.textContent.trim() || button.getAttribute('aria-label'))

    expect(labels).toEqual(['Home', 'Map', 'Report', 'Feed', 'Profile'])
    expect(within(navigation).queryByRole('button', { name: 'Alerts' })).not.toBeInTheDocument()
  })

  it('shows the report form at /report', async () => {
    await renderAppAt('/report')
    expect(await screen.findByText('Report form')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
  })

  it('navigates between shell tabs', async () => {
    await renderAppAt('/')
    fireEvent.click(screen.getByRole('button', { name: /feed/i }))
    await waitFor(() => {
      expect(screen.getByText(/Feed tab/)).toBeInTheDocument()
    })
  })

  it('shows incident detail without shell chrome at /incidents/:id', async () => {
    await renderAppAt('/incidents/test-id')
    expect(await screen.findByText('Incident detail')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
  })

  it('shows the Response Thread without bottom navigation', async () => {
    useMyActiveReportsMock.mockReturnValue({
      reports: [
        {
          publicRef: 'report-123',
          reportType: 'flood',
          severity: 'high',
          lat: 14.11,
          lng: 122.95,
          submittedAt: 1_713_350_000_000,
          lastStatusAt: 1_713_350_060_000,
          status: 'en_route',
          municipalityLabel: 'Daet',
        },
      ],
      loading: false,
      status: 'ready',
      error: null,
      retry: vi.fn(),
    })

    await renderAppAt('/track/report-123')

    expect(await screen.findByRole('heading', { name: 'Response thread' })).toBeInTheDocument()
    expect(screen.getByText('report-123')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Help is on the way', level: 2 }),
    ).toBeInTheDocument()
    const currentStage = screen.getByRole('button', {
      name: /Response coordinated Current/,
    })
    expect(currentStage).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(currentStage)
    expect(currentStage).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
  })

  it('shows register page at /register', async () => {
    await renderAppAt('/register')
    expect(await screen.findByText('Register page')).toBeInTheDocument()
  })

  it('shows settings page at /settings', async () => {
    await renderAppAt('/settings')
    expect(await screen.findByText('Settings page')).toBeInTheDocument()
  })
})
