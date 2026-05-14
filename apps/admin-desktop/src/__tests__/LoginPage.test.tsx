import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockSignInWithEmailAndPassword = vi.hoisted(() => vi.fn())

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

  it('accepts provincial_superadmin and navigates to dashboard', async () => {
    const user = userEvent.setup()
    mockSignInWithEmailAndPassword.mockResolvedValue(mockUserWithRole('provincial_superadmin'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'superadmin@test.local')
    await user.type(screen.getByLabelText(/password/i), 'test123456')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('button', { name: /sign in/i })
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
