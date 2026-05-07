import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'

const { authState } = vi.hoisted(() => ({
  authState: { role: 'provincial_superadmin' },
}))

const { mockOnSnapshot, mockReplayDeadLetter, mockPrewarmSurge } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(() => vi.fn()),
  mockReplayDeadLetter: vi.fn(),
  mockPrewarmSurge: vi.fn(),
}))

vi.mock('@bantayog/shared-ui', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { uid: 'superadmin-1' },
    claims: { role: authState.role },
    loading: false,
    signOut: vi.fn(),
    refreshClaims: vi.fn(),
  }),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: mockOnSnapshot,
}))

vi.mock('../app/firebase', () => ({ db: {} }))

vi.mock('../services/callables', () => ({
  callables: {
    replayDeadLetter: (...args: unknown[]) => mockReplayDeadLetter(...args),
    prewarmSurge: (...args: unknown[]) => mockPrewarmSurge(...args),
  },
}))

vi.mock('../components/Sidebar', () => ({ Sidebar: () => <div>legacy sidebar</div> }))
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <div>login page</div> }))
vi.mock('../pages/TotpEnrollmentPage', () => ({ TotpEnrollmentPage: () => <div>totp page</div> }))
vi.mock('../pages/TriageQueuePage', () => ({ TriageQueuePage: () => <div>triage queue</div> }))
vi.mock('../pages/AgencyAssistanceQueuePage', () => ({
  AgencyAssistanceQueuePage: () => <div>agency assistance</div>,
}))
vi.mock('../pages/AnalyticsDashboardPage', () => ({
  AnalyticsDashboardPage: () => <div>live analytics</div>,
}))
vi.mock('../pages/RosterPage', () => ({ RosterPage: () => <div>roster page</div> }))
vi.mock('../pages/ProvinceDashboardPage', () => ({
  ProvinceDashboardPage: () => <div>live province dashboard</div>,
}))
vi.mock('../pages/ProvinceMapPage', () => ({
  ProvinceMapPage: () => <div>live province map</div>,
}))
vi.mock('../pages/UserManagementPage', () => ({
  UserManagementPage: () => <div>live province users</div>,
}))
vi.mock('../pages/ProvincialResourcesPage', () => ({
  ProvincialResourcesPage: () => <div>live province resources</div>,
}))
vi.mock('../pages/SystemHealthPage', () => ({
  SystemHealthPage: () => <div>live province health</div>,
}))
vi.mock('../pages/BreakGlassPage', () => ({ BreakGlassPage: () => <div>break glass page</div> }))
vi.mock('../pages/DashboardPage', () => ({ default: () => <div>prototype dashboard</div> }))
vi.mock('../pages/MapPage', () => ({ default: () => <div>prototype map</div> }))
vi.mock('../pages/UsersPage', () => ({ default: () => <div>prototype users</div> }))
vi.mock('../pages/EmergencyPage', () => ({ default: () => <div>prototype emergency</div> }))
vi.mock('../pages/NdrrmcPage', () => ({ default: () => <div>prototype ndrrmc</div> }))
vi.mock('../pages/ReportsPage', () => ({ default: () => <div>prototype reports</div> }))
vi.mock('../pages/AuditPage', () => ({ default: () => <div>prototype audit</div> }))
vi.mock('../pages/HealthPage', () => ({ default: () => <div>prototype health</div> }))
vi.mock('../pages/SmsPage', () => ({ default: () => <div>sms page</div> }))
vi.mock('../pages/HandoffPage', () => ({ default: () => <div>handoff page</div> }))
vi.mock('../pages/ErasurePage', () => ({ default: () => <div>erasure page</div> }))
vi.mock('../pages/SettingsPage', () => ({ default: () => <div>settings page</div> }))

async function renderPath(path: string) {
  window.history.replaceState({}, '', path)
  const { router } = await import('../routes')
  const view = render(<RouterProvider router={router} />)
  return { ...view, router }
}

describe('prototype route redirects', () => {
  beforeEach(() => {
    authState.role = 'provincial_superadmin'
  })

  afterEach(() => {
    cleanup()
    vi.resetModules()
  })

  it.each([
    ['/dashboard', 'live province dashboard'],
    ['/map', 'live province map'],
    ['/users', 'live province users'],
    ['/health', 'live province health'],
    ['/reports', 'live analytics'],
    ['/emergency', 'live province dashboard'],
    ['/ndrrmc', 'live province dashboard'],
    ['/audit', 'live province dashboard'],
    ['/handoff', 'live province dashboard'],
    ['/erasure', 'live province users'],
    ['/settings', 'live province dashboard'],
  ])('redirects %s for provincial superadmins', async (path, expectedText) => {
    await renderPath(path)
    expect(await screen.findByText(expectedText)).toBeInTheDocument()
  })

  it('keeps the prototype dashboard for non-superadmin roles', async () => {
    authState.role = 'municipal_admin'
    await renderPath('/dashboard')
    expect(await screen.findByText('prototype dashboard')).toBeInTheDocument()
  })

  it('only exposes real system health actions', async () => {
    const { SystemHealthPage } = await vi.importActual<typeof import('../pages/SystemHealthPage')>(
      '../pages/SystemHealthPage',
    )

    render(<SystemHealthPage />)

    expect(await screen.findByRole('button', { name: /dead-letter replay/i })).toBeInTheDocument()
    expect(screen.queryByText(/declare signal/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/clear active signal/i)).not.toBeInTheDocument()
  })
})
