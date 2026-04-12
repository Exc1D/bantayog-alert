/**
 * RegisteredProfile Privacy Link Tests
 *
 * Tests for privacy policy link in settings tab.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { RegisteredProfile } from '../RegisteredProfile'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as useAuthModule from '@/shared/hooks/useAuth'

// Mock firebase/firestore to prevent initialization errors
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

// Mock profile service
vi.mock('../../services/profile.service', () => ({
  getUserReportsWithDetails: vi.fn().mockResolvedValue([]),
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

describe('RegisteredProfile - Privacy Link', () => {
  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
    mockNavigate.mockReset()

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: vi.fn(),
      signOut: mockSignOut,
    })
  })

  it('should render privacy policy link in settings tab', async () => {
    const user = userEvent.setup()
    render(<RegisteredProfile />, { wrapper: createWrapper() })

    // Navigate to settings tab
    const settingsTab = screen.getByTestId('tab-settings')
    await user.click(settingsTab)

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')
    expect(privacyLink).toHaveAttribute('target', '_blank')
    expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
