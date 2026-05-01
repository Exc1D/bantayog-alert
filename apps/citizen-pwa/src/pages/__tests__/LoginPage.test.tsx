import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../LoginPage.js'

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
  signInWithPhoneNumber: vi.fn(),
  PhoneAuthProvider: {
    credential: vi.fn((verificationId: string, code: string) => ({ verificationId, code })),
  },
  onAuthStateChanged: vi.fn(() => vi.fn()),
}))

// Mock RecaptchaVerifier
const mockRecaptchaVerifier = {
  verify: vi.fn(),
  clear: vi.fn(),
  render: vi.fn(),
}
vi.mock('firebase/auth', async (importOriginal) => {
  const auth = await importOriginal<typeof import('firebase/auth')>()
  return {
    ...auth,
    RecaptchaVerifier: vi.fn(() => mockRecaptchaVerifier),
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderWithRouter() {
    render(
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
})
