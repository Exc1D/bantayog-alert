import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useResumeRegistration } from '../useResumeRegistration'

const mockNavigate = vi.fn()
const mockUnsubscribe = vi.fn()
let mockAuthCallback: ((user: unknown) => void) | null = null

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/', search: '' }),
  }
})

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    mockAuthCallback = callback
    return mockUnsubscribe
  }),
}))

vi.mock('../../services/firebase.js', () => ({
  auth: vi.fn(() => ({
    currentUser: null,
  })),
  db: vi.fn(() => ({
    app: {},
  })),
  hasFirebaseConfig: vi.fn(() => true),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
}))

describe('useResumeRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthCallback = null
  })

  it('does nothing when user is anonymous', () => {
    renderHook(
      () => {
        useResumeRegistration()
      },
      {
        wrapper: MemoryRouter,
      },
    )

    mockAuthCallback?.({
      isAnonymous: true,
      phoneNumber: null,
      uid: 'anon-1',
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does nothing when user has no phone number', () => {
    renderHook(
      () => {
        useResumeRegistration()
      },
      {
        wrapper: MemoryRouter,
      },
    )

    mockAuthCallback?.({
      isAnonymous: false,
      phoneNumber: null,
      uid: 'user-1',
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to /register?resume=registration when phone user has no citizen doc', async () => {
    renderHook(
      () => {
        useResumeRegistration()
      },
      {
        wrapper: MemoryRouter,
      },
    )

    mockAuthCallback?.({
      isAnonymous: false,
      phoneNumber: '+639171234567',
      uid: 'user-1',
    })

    // Wait for async getDoc
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/register?resume=registration', { replace: true })
    })
  })
})
