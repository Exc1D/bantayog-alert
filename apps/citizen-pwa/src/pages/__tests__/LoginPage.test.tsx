import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../LoginPage.js'

// Mock RecaptchaVerifier
const mockRecaptchaVerifier = {
  verify: vi.fn(),
  clear: vi.fn(),
  render: vi.fn(),
}

// Mock Firebase auth (consolidated single mock)
vi.mock('firebase/auth', async (importOriginal) => {
  const auth = await importOriginal<typeof import('firebase/auth')>()
  return {
    ...auth,
    signInWithPhoneNumber: vi.fn(),
    signInWithCredential: vi.fn(),
    PhoneAuthProvider: {
      credential: vi.fn((verificationId: string, code: string) => ({ verificationId, code })),
    },
    onAuthStateChanged: vi.fn(() => vi.fn()),
    RecaptchaVerifier: vi.fn(function (this: unknown) {
      return mockRecaptchaVerifier
    }),
  }
})

const mockToast = vi.fn()

// Mock useToast
vi.mock('../../hooks/useToast.js', () => ({
  useToast: () => ({
    show: false,
    message: '',
    type: 'info' as const,
    toast: mockToast,
  }),
}))

// Mock firebase services
vi.mock('../../services/firebase.js', () => ({
  auth: () => ({
    currentUser: null,
  }),
  hasFirebaseConfig: () => true,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderWithRouter() {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
  }

  it('should render phone input form initially', () => {
    renderWithRouter()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
  })

  it('should show button and input', () => {
    renderWithRouter()
    const continueButton = screen.getByRole('button', { name: /continue/i })
    expect(continueButton).toBeInTheDocument()
    expect(continueButton).toHaveAttribute('type', 'submit')
  })

  it('should validate phone number format', async () => {
    renderWithRouter()
    const phoneInput = screen.getByLabelText(/phone number/i)
    const continueButton = screen.getByRole('button', { name: /continue/i })

    await userEvent.type(phoneInput, '+63123')
    await userEvent.click(continueButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        'Please enter a valid Philippine mobile number',
        'error',
      )
    })
  })

  it('should submit phone number and show OTP step', async () => {
    const { signInWithPhoneNumber } = await import('firebase/auth')
    vi.mocked(signInWithPhoneNumber).mockResolvedValueOnce({
      verificationId: 'test-verification-id',
      confirm: vi.fn(),
    })

    renderWithRouter()
    const phoneInput = screen.getByLabelText(/phone number/i)
    const continueButton = screen.getByRole('button', { name: /continue/i })

    await userEvent.clear(phoneInput)
    await userEvent.type(phoneInput, '+639171234567')
    await userEvent.click(continueButton)

    await waitFor(() => {
      expect(signInWithPhoneNumber).toHaveBeenCalledWith(
        expect.anything(),
        '+639171234567',
        expect.anything(),
      )
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
    })
  })

  it('should verify OTP and sign in', async () => {
    const { signInWithPhoneNumber, signInWithCredential } = await import('firebase/auth')
    vi.mocked(signInWithPhoneNumber).mockResolvedValueOnce({
      verificationId: 'test-verification-id',
      confirm: vi.fn(),
    })
    vi.mocked(signInWithCredential).mockResolvedValueOnce({
      user: { uid: 'test-uid' },
    } as unknown as Awaited<ReturnType<typeof signInWithCredential>>)

    renderWithRouter()
    const phoneInput = screen.getByLabelText(/phone number/i)
    const continueButton = screen.getByRole('button', { name: /continue/i })

    await userEvent.clear(phoneInput)
    await userEvent.type(phoneInput, '+639171234567')
    await userEvent.click(continueButton)

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
    })

    const otpInput = screen.getByLabelText(/verification code/i)
    const signInButton = screen.getByRole('button', { name: /sign in/i })

    await userEvent.type(otpInput, '123456')
    await userEvent.click(signInButton)

    await waitFor(() => {
      expect(signInWithCredential).toHaveBeenCalled()
    })
  })
})
