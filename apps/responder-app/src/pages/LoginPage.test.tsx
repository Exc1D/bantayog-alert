import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockSignIn = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn())
const mockGetIdTokenResult = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({
  auth: {},
}))
vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>()
  return {
    ...actual,
    signInWithEmailAndPassword: mockSignIn,
    signOut: mockSignOut,
  }
})
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_USE_EMULATOR', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders Bantayog branding and login form', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/bantayog alert/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('submits email and password to Firebase Auth', async () => {
    mockSignIn.mockResolvedValue({
      user: { getIdTokenResult: mockGetIdTokenResult },
    })
    mockGetIdTokenResult.mockResolvedValue({
      claims: { role: 'responder' },
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@bantayog.test')
    await user.type(screen.getByLabelText(/password/i), 'Test1234!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockSignIn).toHaveBeenCalledWith(expect.anything(), 'test@bantayog.test', 'Test1234!')
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('rejects non-responder accounts with error message', async () => {
    mockSignIn.mockResolvedValue({
      user: { getIdTokenResult: mockGetIdTokenResult },
    })
    mockGetIdTokenResult.mockResolvedValue({
      claims: { role: 'citizen' },
    })
    mockSignOut.mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'citizen@bantayog.test')
    await user.type(screen.getByLabelText(/password/i), 'Test1234!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/not registered as a responder/i)
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('displays error when signInWithEmailAndPassword fails', async () => {
    mockSignIn.mockRejectedValue(new Error('auth/invalid-credential'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'bad@bantayog.test')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/auth\/invalid-credential/i)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows loading state while signing in', async () => {
    mockSignIn.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@bantayog.test')
    await user.type(screen.getByLabelText(/password/i), 'Test1234!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('skips role check and navigates when emulator mode is active', async () => {
    vi.stubEnv('VITE_USE_EMULATOR', 'true')
    mockSignIn.mockResolvedValue({
      user: { getIdTokenResult: mockGetIdTokenResult },
    })
    mockGetIdTokenResult.mockResolvedValue({ claims: {} })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@bantayog.test')
    await user.type(screen.getByLabelText(/password/i), 'Test1234!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    expect(mockSignOut).not.toHaveBeenCalled()
  })
})
