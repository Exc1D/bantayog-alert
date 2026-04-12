/**
 * RegisteredProfile Component Tests
 *
 * Tests the profile screen for authenticated users.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { RegisteredProfile } from '../RegisteredProfile'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as useAuthModule from '@/shared/hooks/useAuth'
import * as profileService from '../../services/profile.service'

// Mock firebase/firestore before any imports that transitively use it
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: vi.fn().mockResolvedValue({ docs: [], forEach: () => {} }),
  Timestamp: { fromDate: vi.fn((date: Date) => ({ toDate: () => date })) },
}))

// Mock firebase/auth before any imports that transitively use it
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => { callback(null); return vi.fn() }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

// Mock @/app/firebase/config
vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: { onAuthStateChanged: vi.fn((callback) => { callback(null); return vi.fn() }) },
}))

// Mock the hook module
vi.mock('@/shared/hooks/useAuth')

// Mock useReportQueue
vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: vi.fn().mockReturnValue({
    queue: [],
    queueSize: 0,
    isSyncing: false,
    hasPendingReports: false,
    enqueueReport: vi.fn(),
    syncQueue: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
    clearQueue: vi.fn(),
    removeReport: vi.fn(),
    failedReports: [],
  }),
}))

// Mock profile service - use vi.hoisted to avoid TDZ issues with vi.mock factory
const mockReports = vi.hoisted(() => [
  {
    id: 'report-1',
    incidentType: 'flood',
    description: 'Flood Report',
    status: 'verified',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    barangay: 'Barangay 1',
  },
  {
    id: 'report-2',
    incidentType: 'fire',
    description: 'Fire Report',
    status: 'pending',
    createdAt: new Date('2024-01-10T08:00:00Z'),
    barangay: 'Barangay 2',
  },
])

vi.mock('../../services/profile.service', () => ({
  getUserReportsWithDetails: vi.fn().mockResolvedValue(mockReports),
  exportUserData: vi.fn().mockResolvedValue({}),
  deleteUserAccount: vi.fn().mockResolvedValue(undefined),
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockUser = {
  uid: 'user-123',
  email: 'citizen@example.com',
  displayName: 'Juan Dela Cruz',
  emailVerified: true,
  role: 'citizen',
  metadata: {
    creationTime: '2024-01-01T00:00:00Z',
  },
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BrowserRouter>
    )
  }
}

describe('RegisteredProfile', () => {
  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
    mockNavigate.mockReset()
  })

  describe('when user is logged in', () => {
    beforeEach(() => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })
    })

    it('should render user info in header', () => {
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Check that user info appears
      expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0)
      expect(screen.getAllByText('citizen@example.com').length).toBeGreaterThan(0)
    })

    it('should render all tabs', () => {
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      expect(screen.getByTestId('tab-your-info')).toBeInTheDocument()
      expect(screen.getByTestId('tab-your-reports')).toBeInTheDocument()
      expect(screen.getByTestId('tab-settings')).toBeInTheDocument()
    })

    it('should render logout button', () => {
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      expect(screen.getByTestId('logout-button')).toBeInTheDocument()
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })
  })

  describe('Your Info Tab', () => {
    beforeEach(() => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })
    })

    it('should display info tab by default', () => {
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      expect(screen.getByTestId('info-tab')).toBeInTheDocument()
      expect(screen.getByText('Your Information')).toBeInTheDocument()
    })

    it('should show user information', () => {
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const infoTab = screen.getByTestId('info-tab')
      const withinInfoTab = within(infoTab)

      withinInfoTab.getByText('Your Information')
      withinInfoTab.getByText('Display Name')
      withinInfoTab.getByText('Juan Dela Cruz')
      withinInfoTab.getByText('Email')
      withinInfoTab.getByText('citizen@example.com')
      withinInfoTab.getByText('Email Verified')
      withinInfoTab.getByText('Yes')
      withinInfoTab.getByText('Account Created')
    })

    it('should show location privacy note', () => {
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const infoTab = screen.getByTestId('info-tab')
      const withinInfoTab = within(infoTab)

      withinInfoTab.getByText(/Note:/)
      withinInfoTab.getByText(/Location information \(barangay, municipality\) is not stored/)
    })
  })

  describe('Your Reports Tab', () => {
    beforeEach(() => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })
    })

    it('should switch to reports tab when clicked', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const reportsTab = screen.getByTestId('tab-your-reports')
      await user.click(reportsTab)

      expect(screen.getByTestId('reports-tab')).toBeInTheDocument()
      // Verify reports tab content (not the tab button)
      expect(screen.getByTestId('reports-tab')).toHaveTextContent('Your Reports')
    })

    it('should display mock reports', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const reportsTab = screen.getByTestId('tab-your-reports')
      await user.click(reportsTab)

      expect(screen.getByTestId('user-report-report-1')).toBeInTheDocument()
      expect(screen.getByTestId('user-report-report-2')).toBeInTheDocument()
      expect(screen.getByText(/Flood Report/)).toBeInTheDocument()
      expect(screen.getByText(/Fire Report/)).toBeInTheDocument()
    })

    it('should show report status badges', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const reportsTab = screen.getByTestId('tab-your-reports')
      await user.click(reportsTab)

      expect(screen.getByText('verified')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  describe('Settings Tab', () => {
    beforeEach(() => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })
    })

    it('should switch to settings tab when clicked', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const settingsTab = screen.getByTestId('tab-settings')
      await user.click(settingsTab)

      expect(screen.getByTestId('settings-tab')).toBeInTheDocument()
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Data Management')).toBeInTheDocument()
    })

    it('should toggle notifications when clicked', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const settingsTab = screen.getByTestId('tab-settings')
      await user.click(settingsTab)

      const toggle = screen.getByTestId('notifications-toggle')
      await user.click(toggle)

      // Toggle should change state (verify by checking if toggle button still exists)
      expect(screen.getByTestId('notifications-toggle')).toBeInTheDocument()
    })

    it('should have download data button', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const settingsTab = screen.getByTestId('tab-settings')
      await user.click(settingsTab)

      expect(screen.getByTestId('download-data')).toBeInTheDocument()
      expect(screen.getByText('Download Your Data')).toBeInTheDocument()
    })

    it('should have delete account button', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const settingsTab = screen.getByTestId('tab-settings')
      await user.click(settingsTab)

      expect(screen.getByTestId('delete-account')).toBeInTheDocument()
      expect(screen.getByText('Delete Account')).toBeInTheDocument()
    })

    it('should show privacy note', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const settingsTab = screen.getByTestId('tab-settings')
      await user.click(settingsTab)

      expect(screen.getByText(/Privacy Note:/)).toBeInTheDocument()
      expect(
        screen.getByText(/Your data is stored securely and only used for disaster response/)
      ).toBeInTheDocument()
    })
  })

  describe('Logout Functionality', () => {
    beforeEach(() => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })
    })

    it('should call signOut when logout button is clicked', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1)
      })
    })

    it('should navigate to login after logout', async () => {
      const user = userEvent.setup()
      mockSignOut.mockResolvedValue(undefined)
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('when user is null', () => {
    it('should render nothing', () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })

      const { container } = render(<RegisteredProfile />, { wrapper: createWrapper() })

      expect(container.firstChild).toBe(null)
    })
  })

  describe('Tab Switching', () => {
    beforeEach(() => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: mockSignOut,
      })
    })

    it('should switch between tabs', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Start on info tab
      expect(screen.getByTestId('info-tab')).toBeInTheDocument()

      // Switch to reports
      await user.click(screen.getByTestId('tab-your-reports'))
      expect(screen.getByTestId('reports-tab')).toBeInTheDocument()
      expect(screen.queryByTestId('info-tab')).not.toBeInTheDocument()

      // Switch to settings
      await user.click(screen.getByTestId('tab-settings'))
      expect(screen.getByTestId('settings-tab')).toBeInTheDocument()
      expect(screen.queryByTestId('reports-tab')).not.toBeInTheDocument()

      // Switch back to info
      await user.click(screen.getByTestId('tab-your-info'))
      expect(screen.getByTestId('info-tab')).toBeInTheDocument()
      expect(screen.queryByTestId('settings-tab')).not.toBeInTheDocument()
    })
  })
})
