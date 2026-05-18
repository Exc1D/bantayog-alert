import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockSignInWithEmailAndPassword = vi.hoisted(() => vi.fn())

// Mutable state to simulate useAuth transitions after sign-in
let mockUser: { uid: string } | null = null
let mockAuthLoading = false

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signOut: mockSignOut,
}))

vi.mock('../app/firebase', () => ({
  auth: { currentUser: null },
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: mockUser, loading: mockAuthLoading }),
}))

import { LoginPage } from '../pages/LoginPage'

function mockUserWithRole(role: string) {
  return {
    user: {
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role },
      }),
    },
  }
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = null
    mockAuthLoading = false
  })

  it('rejects legacy superadmin role and shows error', async () => {
    const user = userEvent.setup()
    mockSignInWithEmailAndPassword.mockResolvedValue(mockUserWithRole('superadmin'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'superadmin@test.local')
    await user.type(screen.getByLabelText(/password/i), 'test123456')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account does not have admin privileges.',
    )
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('rejects legacy admin role and shows error', async () => {
    const user = userEvent.setup()
    mockSignInWithEmailAndPassword.mockResolvedValue(mockUserWithRole('admin'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'admin@test.local')
    await user.type(screen.getByLabelText(/password/i), 'test123456')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account does not have admin privileges.',
    )
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to dashboard ONLY after auth state propagates (not from submit)', async () => {
    const user = userEvent.setup()
    mockSignInWithEmailAndPassword.mockResolvedValue(mockUserWithRole('provincial_superadmin'))

    const { rerender } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'superadmin@test.local')
    await user.type(screen.getByLabelText(/password/i), 'test123456')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Wait for handleSubmit to finish
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })

    // Navigating from submit is the bug. After the fix, navigate should NOT have
    // been called yet because the batched auth state hasn't propagated.
    expect(mockNavigate).not.toHaveBeenCalled()

    // Simulate AuthProvider state change after onAuthStateChanged fires
    mockUser = { uid: 'test-superadmin' }
    rerender(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
