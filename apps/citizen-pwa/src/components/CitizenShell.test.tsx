import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { CitizenShell } from './CitizenShell.js'

const mockUseOfflineQueueCount = vi.fn()
const mockUseUIStore = vi.fn()
const mockUseMyActiveReports = vi.fn()

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

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

function renderShell(
  pathname = '/',
  opts?: {
    offline?: boolean
    queueCount?: number
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
  mockUseOfflineQueueCount.mockReturnValue({
    isOnline: opts?.offline ? false : true,
    queueCount: opts?.queueCount ?? 0,
  })
  mockUseUIStore.mockReturnValue({
    navDirection: 'forward' as const,
    setNavDirection: vi.fn(),
  })
  mockUseMyActiveReports.mockReturnValue({ reports: opts?.activeReports ?? [], loading: false })

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
          { index: true, element: <div>Map content</div> },
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
    expect(screen.getByRole('button', { name: /map/i })).toHaveAttribute('aria-current', 'page')
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
    expect(screen.getByText('Offline — 3 reports queued')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /view your active report/i })).toBeInTheDocument()
  })

  it('does not render the status pill when no active reports', () => {
    renderShell('/')
    expect(
      screen.queryByRole('button', { name: /view your active report/i }),
    ).not.toBeInTheDocument()
  })
})
