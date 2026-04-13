/**
 * RegisteredProfile Error Handling Tests
 *
 * Tests error flows for delete account, download data, sync, and logout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { RegisteredProfile } from '../RegisteredProfile'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as useAuthModule from '@/shared/hooks/useAuth'

// ---------------------------------------------------------------------------
// Mock firebase/firestore - must be before any imports that transitively use it
// ---------------------------------------------------------------------------
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: vi.fn().mockResolvedValue({ docs: [], forEach: () => {} }),
  Timestamp: { fromDate: vi.fn((date: Date) => ({ toDate: () => date })) },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => { callback(null); return vi.fn() }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: { onAuthStateChanged: vi.fn((callback) => { callback(null); return vi.fn() }) },
}))

// ---------------------------------------------------------------------------
// Hoisted mock functions for per-test configuration
// ---------------------------------------------------------------------------
const mockExportUserData = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockDeleteUserAccount = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockSyncQueue = vi.hoisted(() => vi.fn().mockResolvedValue({ success: 0, failed: 0 }))

// ---------------------------------------------------------------------------
// Mock profile service
// ---------------------------------------------------------------------------
vi.mock('../../services/profile.service', () => ({
  getUserReportsWithDetails: vi.fn().mockResolvedValue([]),
  exportUserData: mockExportUserData,
  deleteUserAccount: mockDeleteUserAccount,
}))

// ---------------------------------------------------------------------------
// Mock useReportQueue
// ---------------------------------------------------------------------------
vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: vi.fn().mockReturnValue({
    queue: [],
    queueSize: 1,
    isSyncing: false,
    hasPendingReports: true,
    enqueueReport: vi.fn(),
    syncQueue: mockSyncQueue,
    clearQueue: vi.fn(),
    removeReport: vi.fn(),
    failedReports: [],
  }),
}))

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------
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

describe('RegisteredProfile Error Handling', () => {
  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
    mockNavigate.mockReset()
    mockDeleteUserAccount.mockResolvedValue(undefined)
    mockExportUserData.mockResolvedValue({})
    mockSyncQueue.mockResolvedValue({ success: 0, failed: 0 })

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: vi.fn(),
      signOut: mockSignOut,
    })
  })

  // -------------------------------------------------------------------------
  // Delete Account Flow
  // -------------------------------------------------------------------------
  describe('Delete Account Flow', () => {
    it('should show delete confirmation modal when delete account clicked', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Navigate to settings tab
      await user.click(screen.getByTestId('tab-settings'))

      // Click delete account button
      await user.click(screen.getByTestId('delete-account'))

      // Verify modal appears (modal has no role="dialog" so check heading text and cancel button)
      expect(screen.getByText('Delete Account?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('should hide modal when cancel clicked', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Open modal
      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('delete-account'))
      expect(screen.getByText('Delete Account?')).toBeInTheDocument()

      // Click cancel
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      // Verify modal disappears
      expect(screen.queryByText('Delete Account?')).not.toBeInTheDocument()
    })

    it('should call deleteUserAccount and navigate to login on confirm', async () => {
      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Open modal and confirm
      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('delete-account'))

      // Click delete
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(mockDeleteUserAccount).toHaveBeenCalledWith('user-123')
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/profile')
      })
    })

    it('should display error message when deletion fails', async () => {
      mockDeleteUserAccount.mockRejectedValueOnce(new Error('Failed to delete account'))

      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Open modal and confirm
      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('delete-account'))
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      // Verify error displayed in modal (scope to modal by finding within the modal container)
      const modal = screen.getByText('Delete Account?').closest('div[class*="rounded-lg"]')
      await waitFor(() => {
        expect(modal?.textContent).toContain('Failed to delete account')
      })

      // Verify navigate was NOT called
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should show recent login error when auth/requires-recent-login is thrown', async () => {
      const mockError = new Error('Firebase: Error (auth/requires-recent-login).')
      // Add code property to simulate Firebase error structure
      ;(mockError as { code?: string }).code = 'auth/requires-recent-login'

      mockDeleteUserAccount.mockRejectedValueOnce(mockError)

      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      // Click delete account button (first open the delete confirmation)
      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('delete-account'))

      // Confirm deletion
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      // Verify user-friendly message is displayed (error appears in both modal and settings tab)
      await waitFor(() => {
        expect(screen.getAllByText(/please log out and log back in/i).length).toBeGreaterThan(0)
      })

      // Verify navigate was NOT called
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Download Data Flow
  // -------------------------------------------------------------------------
  describe('Download Data Flow', () => {
    it('should call exportUserData when download clicked', async () => {
      const user = userEvent.setup()
      // Mock URL.createObjectURL to avoid actual blob creation
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-url')
      const mockRevokeObjectURL = vi.fn()
      URL.createObjectURL = mockCreateObjectURL
      URL.revokeObjectURL = mockRevokeObjectURL

      render(<RegisteredProfile />, { wrapper: createWrapper() })

      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('download-data'))

      await waitFor(() => {
        expect(mockExportUserData).toHaveBeenCalledWith(
          'user-123',
          'citizen@example.com',
          'citizen',
          expect.any(Number)
        )
      })
    })

    it('should display error when download fails', async () => {
      mockExportUserData.mockRejectedValueOnce(new Error('Export failed'))

      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('download-data'))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Export failed')
      })
    })
  })

  // -------------------------------------------------------------------------
  // Sync Error Flow
  // -------------------------------------------------------------------------
  describe('Sync Flow', () => {
    it('should display error when sync fails', async () => {
      mockSyncQueue.mockRejectedValueOnce(new Error('Sync failed: network error'))

      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      await user.click(screen.getByTestId('tab-settings'))
      await user.click(screen.getByTestId('sync-now-button'))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Sync failed')
      })
    })

    it('should clear previous syncResult when sync fails', async () => {
      // First sync succeeds
      mockSyncQueue.mockResolvedValueOnce({ success: 5, failed: 0 })
      mockSyncQueue.mockRejectedValueOnce(new Error('Second sync failed'))

      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      await user.click(screen.getByTestId('tab-settings'))

      // First sync
      await user.click(screen.getByTestId('sync-now-button'))
      await waitFor(() => {
        expect(screen.getByText(/Last sync: 5 synced/)).toBeInTheDocument()
      })

      // Second sync fails
      await user.click(screen.getByTestId('sync-now-button'))
      await waitFor(() => {
        expect(screen.queryByText(/Last sync: 5 synced/)).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Second sync failed')
      })
    })
  })

  // -------------------------------------------------------------------------
  // Logout Error Flow
  // -------------------------------------------------------------------------
  describe('Logout Flow', () => {
    it('should display error when logout fails', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Logout failed'))

      const user = userEvent.setup()
      render(<RegisteredProfile />, { wrapper: createWrapper() })

      await user.click(screen.getByTestId('logout-button'))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Logout failed')
      })

      // Verify navigate was NOT called
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
