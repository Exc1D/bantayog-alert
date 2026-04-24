import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './protected-route.js'
import { AuthProvider } from './auth-provider.js'

let mockOnAuthStateChanged = vi.fn()

vi.mock('firebase/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signOut: vi.fn().mockResolvedValue(undefined),
}))

function TestApp({
  auth,
  initialEntry = '/',
}: {
  auth: import('firebase/auth').Auth
  initialEntry?: string
}) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider auth={auth}>
        <Routes>
          <Route path="/login" element={<div data-testid="login">Login</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['responder']}>
                <div data-testid="protected">Protected</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockOnAuthStateChanged = vi.fn()
  })

  it('redirects to login when not authenticated', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null)
      return vi.fn()
    })

    const mockAuth = { currentUser: null } as unknown as import('firebase/auth').Auth
    render(<TestApp auth={mockAuth} />)

    expect(await screen.findByTestId('login')).toBeDefined()
  })

  it('renders children when user has allowed role', async () => {
    const mockUser = {
      uid: 'u1',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'responder' },
      }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return vi.fn()
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth
    render(<TestApp auth={mockAuth} />)

    expect(await screen.findByTestId('protected')).toBeDefined()
  })

  it('renders unauthorized fallback when role is not allowed', async () => {
    const mockUser = {
      uid: 'u1',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'municipal_admin' },
      }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return vi.fn()
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth
    render(<TestApp auth={mockAuth} />)

    expect(await screen.findByText('Access denied.')).toBeDefined()
  })

  it('renders unauthorized when requireActive is true and user is inactive', async () => {
    const mockUser = {
      uid: 'u1',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'responder', active: false },
      }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return vi.fn()
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider auth={mockAuth}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={['responder']} requireActive>
                  <div data-testid="protected">Protected</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Access denied.')).toBeDefined()
  })

  it('renders unauthorized when municipalityId is required but missing', async () => {
    const mockUser = {
      uid: 'u1',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'municipal_admin', active: true },
      }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return vi.fn()
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider auth={mockAuth}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute
                  allowedRoles={['municipal_admin']}
                  requireActive
                  requireMunicipalityIdForRoles={['municipal_admin']}
                >
                  <div data-testid="protected">Protected</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Access denied.')).toBeDefined()
  })
})
