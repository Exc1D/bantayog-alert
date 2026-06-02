import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RegisterPage } from './RegisterPage'

vi.mock('firebase/auth', () => ({
  linkWithPhoneNumber: vi.fn(),
  RecaptchaVerifier: vi.fn().mockImplementation(() => ({ clear: vi.fn() })),
  updateProfile: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/firebase.js', () => ({
  auth: () => ({ currentUser: { uid: 'test' } }),
}))

vi.mock('../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ show: false, message: '', type: 'info', toast: vi.fn() }),
}))

vi.mock('../components/Toast.js', () => ({
  Toast: () => null,
}))

describe('RegisterPage', () => {
  it('renders Step 1 phone input', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    expect(screen.getByPlaceholderText('+63XXXXXXXXXX')).toBeInTheDocument()
    expect(screen.getByText('Send verification code')).toBeInTheDocument()
  })

  it('shows navy header with Register title', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Register')).toBeInTheDocument()
  })
})
