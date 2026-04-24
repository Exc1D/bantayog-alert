import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './auth-provider.js'

let mockOnAuthStateChanged = vi.fn()
let mockSignOut = vi.fn()

vi.mock('firebase/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

function TestConsumer() {
  const { user, claims, loading, signOut, refreshClaims } = useAuth()
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? user.uid : 'none'}</div>
      <div data-testid="claims">{claims ? JSON.stringify(claims) : 'none'}</div>
      <button data-testid="signout" onClick={() => void signOut()}>
        Sign out
      </button>
      <button data-testid="refresh" onClick={() => void refreshClaims()}>
        Refresh
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockOnAuthStateChanged = vi.fn()
    mockSignOut = vi.fn().mockResolvedValue(undefined)
  })

  it('shows ready with no user when auth state is null', async () => {
    const unsubscribe = vi.fn()
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null)
      return unsubscribe
    })

    const mockAuth = { currentUser: null } as unknown as import('firebase/auth').Auth

    render(
      <AuthProvider auth={mockAuth}>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('claims').textContent).toBe('none')
  })

  it('sets user and claims when authenticated', async () => {
    const unsubscribe = vi.fn()
    const mockUser = {
      uid: 'test-uid',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'responder', municipalityId: 'daet' },
      }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return unsubscribe
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth

    render(
      <AuthProvider auth={mockAuth}>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })
    expect(screen.getByTestId('user').textContent).toBe('test-uid')
    expect(screen.getByTestId('claims').textContent).toBe(
      JSON.stringify({ role: 'responder', municipalityId: 'daet' }),
    )
  })

  it('calls signOut when signOut button is clicked', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null)
      return vi.fn()
    })

    const mockAuth = { currentUser: null } as unknown as import('firebase/auth').Auth

    render(
      <AuthProvider auth={mockAuth}>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    act(() => {
      screen.getByTestId('signout').click()
    })

    expect(mockSignOut).toHaveBeenCalledWith(mockAuth)
  })

  it('refreshes claims when refreshClaims is called', async () => {
    const unsubscribe = vi.fn()
    const mockUser = {
      uid: 'test-uid',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'responder' },
      }),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return unsubscribe
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth

    render(
      <AuthProvider auth={mockAuth}>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })
    expect(screen.getByTestId('claims').textContent).toBe(JSON.stringify({ role: 'responder' }))

    mockUser.getIdTokenResult.mockResolvedValue({
      claims: { role: 'responder', municipalityId: 'daet' },
    })

    act(() => {
      screen.getByTestId('refresh').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('claims').textContent).toBe(
        JSON.stringify({ role: 'responder', municipalityId: 'daet' }),
      )
    })
  })

  it('sets claims to null when getIdTokenResult fails', async () => {
    const unsubscribe = vi.fn()
    const mockUser = {
      uid: 'test-uid',
      getIdTokenResult: vi.fn().mockRejectedValue(new Error('token expired')),
    }

    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(mockUser)
      return unsubscribe
    })

    const mockAuth = { currentUser: mockUser } as unknown as import('firebase/auth').Auth

    render(
      <AuthProvider auth={mockAuth}>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })
    expect(screen.getByTestId('claims').textContent).toBe('none')
  })

  it('throws when useAuth is called outside AuthProvider', () => {
    function BadComponent() {
      useAuth()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow('useAuth must be used inside <AuthProvider>')
  })
})
