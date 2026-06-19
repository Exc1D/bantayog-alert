import '@testing-library/jest-dom/vitest'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

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

vi.mock('./pages/SplashScreen.js', () => ({
  SplashScreen: ({ onDone }: { onDone?: () => void }) => {
    // Defer onDone to microtask so it doesn't trigger setState during render.
    void Promise.resolve().then(() => onDone?.())
    return null
  },
}))

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

async function renderAppAt(pathname: string) {
  window.history.pushState({}, '', pathname)
  vi.resetModules()
  const { App } = await import('./App.js')
  return render(<App />)
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
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

  it('shows the Response Thread placeholder without bottom navigation', async () => {
    await renderAppAt('/track/report-123')
    expect(await screen.findByTestId('response-thread-placeholder')).toBeInTheDocument()
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
