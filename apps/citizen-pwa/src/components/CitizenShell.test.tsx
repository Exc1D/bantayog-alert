import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { CitizenShell } from './CitizenShell.js'
import { HomeTab } from './HomeTab/index.js'

const mockUseOfflineQueueCount = vi.fn()
const mockUseUIStore = vi.fn()
const mockUseMyActiveReports = vi.fn()
const mockUseAlertReadState = vi.fn()
const mockUseAlerts = vi.fn()
const mockUseReducedMotion = vi.fn()

vi.mock('../hooks/useOfflineQueueCount.js', () => ({
  useOfflineQueueCount: () => mockUseOfflineQueueCount(),
}))

vi.mock('../lib/store.js', () => ({
  useUIStore: (
    selector: (s: {
      navDirection: 'forward'
      setNavDirection: (_d: 'forward' | 'backward') => void
    }) => unknown,
  ) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    selector(mockUseUIStore()),
}))

vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))

vi.mock('../hooks/useAlertReadState.js', () => ({
  useAlertReadState: () => mockUseAlertReadState(),
}))

vi.mock('../hooks/useAlerts.js', () => ({
  useAlerts: () => mockUseAlerts(),
}))

vi.mock('../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

beforeEach(() => {
  // Mock localStorage for ReportStatusPill
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  })
})

function renderShell(
  pathname = '/',
  opts?: {
    home?: boolean
    offline?: boolean
    queueCount?: number
    unreadAlerts?: number
    alerts?: {
      id: string
      title: string
      body: string
      severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
      publishedAt: number
      publishedBy: string
    }[]
    activeReports?: {
      publicRef: string
      reportType: string
      severity: string
      lat: number
      lng: number
      submittedAt: number
      status: string
      municipalityLabel: string
    }[]
  },
) {
  const {
    activeReports = [],
    alerts = [],
    home = false,
    offline = false,
    queueCount = 0,
    unreadAlerts = 0,
  } = opts ?? {}

  mockUseOfflineQueueCount.mockReturnValue({
    isOnline: !offline,
    queueCount,
  })
  mockUseUIStore.mockReturnValue({
    navDirection: 'forward' as const,
    setNavDirection: vi.fn(),
  })
  mockUseMyActiveReports.mockReturnValue({ reports: activeReports, loading: false })
  mockUseAlertReadState.mockReturnValue({
    unreadCount: () => unreadAlerts,
    markAsRead: vi.fn(),
  })
  mockUseAlerts.mockReturnValue({ alerts })
  mockUseReducedMotion.mockReturnValue(false)

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <CitizenShell>
            <Outlet />
          </CitizenShell>
        ),
        children: [
          { index: true, element: home ? <HomeTab /> : <div>Map content</div> },
          { path: 'report', element: <div>Report content</div> },
          { path: 'feed', element: <div>Feed content</div> },
        ],
      },
    ],
    { initialEntries: [pathname] },
  )

  return render(<RouterProvider router={router} />)
}

describe('CitizenShell', () => {
  it('renders the fixed chrome and active tab', () => {
    renderShell('/')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /home/i })).toHaveAttribute('aria-current', 'page')
  })

  it('feeds Home header from the shell-owned alert and report sources', () => {
    renderShell('/', {
      alerts: [
        {
          id: 'alert-1',
          title: 'Flood alert',
          body: 'Stay alert near waterways.',
          severity: 'high',
          publishedAt: Date.now() - 60_000,
          publishedBy: 'admin-1',
        },
      ],
      activeReports: [
        {
          publicRef: 'a1b2c3d4',
          reportType: 'flood',
          severity: 'high',
          lat: 14.11,
          lng: 122.95,
          submittedAt: Date.now() - 120_000,
          status: 'awaiting_verify',
          municipalityLabel: 'Daet',
        },
      ],
      home: true,
      unreadAlerts: 1,
    })

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Daet')).toBeInTheDocument()
    expect(screen.getByText(/^Updated /)).toBeInTheDocument()
  })

  it('pauses the report FAB ambient motion while Home shows an official alert', () => {
    renderShell('/', {
      alerts: [
        {
          id: 'alert-1',
          title: 'Flood alert',
          body: 'Stay alert near waterways.',
          severity: 'high',
          publishedAt: Date.now() - 60_000,
          publishedBy: 'admin-1',
        },
      ],
      home: true,
    })

    expect(screen.getByRole('button', { name: 'Report' })).not.toHaveClass('fab-breathe')
  })

  it('keeps report FAB ambient motion for non-emergency Home alerts', () => {
    renderShell('/', {
      alerts: [
        {
          id: 'alert-1',
          title: 'Weather advisory',
          body: 'Expect light rain.',
          severity: 'low',
          publishedAt: Date.now() - 60_000,
          publishedBy: 'admin-1',
        },
      ],
      home: true,
    })

    expect(screen.getByRole('button', { name: 'Report' })).toHaveClass('fab-breathe')
  })

  it('navigates to report and feed tabs', async () => {
    renderShell('/')
    fireEvent.click(screen.getByRole('button', { name: /report/i }))
    await waitFor(() => {
      expect(screen.getByText('Report content')).toBeInTheDocument()
    })
    expect(screen.getByText('Report content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /feed/i }))
    await waitFor(() => {
      expect(screen.getByText('Feed content')).toBeInTheDocument()
    })
  })

  it('shows offline banner when navigatorOnline is false', () => {
    renderShell('/', { offline: true, queueCount: 3 })
    expect(screen.getByText('Offline. 3 reports queued')).toBeInTheDocument()
  })

  it('hides offline banner when online', () => {
    renderShell('/')
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
  })

  it('renders the report status pill when there is an active report', () => {
    renderShell('/', {
      activeReports: [
        {
          publicRef: 'a1b2c3d4',
          reportType: 'flood',
          severity: 'high',
          lat: 14.11,
          lng: 122.95,
          submittedAt: 1713350400000,
          status: 'awaiting_verify',
          municipalityLabel: 'Daet',
        },
      ],
    })
    expect(screen.getByRole('button', { name: /active report/i })).toBeInTheDocument()
  })

  it('shows a centered notification when responders are on their way', () => {
    renderShell('/', {
      activeReports: [
        {
          publicRef: 'a1b2c3d4',
          reportType: 'flood',
          severity: 'high',
          lat: 14.11,
          lng: 122.95,
          submittedAt: 1713350400000,
          status: 'assigned',
          municipalityLabel: 'Daet',
        },
      ],
    })

    const dialog = screen.getByRole('dialog', { name: /responders are on their way/i })
    expect(dialog).toHaveTextContent('Flood')
    expect(dialog.className).toContain('top-1/2')
  })

  it('does not render the status pill when no active reports', () => {
    renderShell('/')
    expect(screen.queryByRole('button', { name: /active report/i })).not.toBeInTheDocument()
  })

  it('shows a centered modal notification for received alerts', () => {
    act(() => {
      renderShell('/', {
        alerts: [
          {
            id: 'alert-1',
            title: 'Flood Alert',
            body: 'Responders are on their way to low-lying areas.',
            severity: 'high',
            publishedAt: 1713350800000,
            publishedBy: 'admin-1',
          },
        ],
      })
    })

    const dialog = screen.getByRole('dialog', { name: /flood alert/i })
    expect(dialog).toHaveTextContent('Responders are on their way')
    expect(dialog.className).toContain('top-1/2')
  })
})
