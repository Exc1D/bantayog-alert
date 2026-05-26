import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockVerifyPasswordResetCode = vi.hoisted(() => vi.fn())
const mockConfirmPasswordReset = vi.hoisted(() => vi.fn())
const mockAnnounce = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: mockVerifyPasswordResetCode,
  confirmPasswordReset: mockConfirmPasswordReset,
}))

vi.mock('../app/firebase', () => ({
  auth: { currentUser: null },
}))

vi.mock('../components/LiveAnnouncer', () => ({
  announce: mockAnnounce,
}))

import { ResetPasswordPage } from '../pages/ResetPasswordPage'

function renderWithParams(params: string) {
  return render(
    <MemoryRouter initialEntries={[`/reset-password?${params}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockVerifyPasswordResetCode.mockImplementation(() => new Promise(() => undefined))
    renderWithParams('oobCode=valid-code')

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows error for invalid/expired reset link', async () => {
    mockVerifyPasswordResetCode.mockRejectedValue(new Error('Invalid code'))
    renderWithParams('oobCode=invalid-code')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid code')
    })
    expect(mockAnnounce).toHaveBeenCalledWith('Error: Invalid code')
  })

  it('shows error when no oobCode is provided', async () => {
    renderWithParams('')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid or expired password reset link.')
    })
    expect(mockAnnounce).toHaveBeenCalledWith('Invalid or expired password reset link.')
  })

  it('shows reset form when code is valid', async () => {
    mockVerifyPasswordResetCode.mockResolvedValue('user@test.local')
    renderWithParams('oobCode=valid-code')

    await waitFor(() => {
      expect(screen.getByText('user@test.local')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument()
  })

  it('resets password successfully and shows success screen', async () => {
    const user = userEvent.setup()
    mockVerifyPasswordResetCode.mockResolvedValue('user@test.local')
    mockConfirmPasswordReset.mockResolvedValue(undefined)

    renderWithParams('oobCode=valid-code')

    await waitFor(() => {
      expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/New Password/i), 'newpassword123')
    await user.type(screen.getByLabelText(/Confirm Password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /Reset Password/i }))

    await waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
        expect.anything(),
        'valid-code',
        'newpassword123',
      )
    })

    expect(screen.getByText('Your password has been updated successfully.')).toBeInTheDocument()
    expect(mockAnnounce).toHaveBeenCalledWith('Password reset successfully.')

    await user.click(screen.getByRole('button', { name: /Sign In/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    mockVerifyPasswordResetCode.mockResolvedValue('user@test.local')

    renderWithParams('oobCode=valid-code')

    await waitFor(() => {
      expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/New Password/i), 'password123')
    await user.type(screen.getByLabelText(/Confirm Password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /Reset Password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    mockVerifyPasswordResetCode.mockResolvedValue('user@test.local')

    renderWithParams('oobCode=valid-code')

    await waitFor(() => {
      expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/New Password/i), 'short')
    await user.type(screen.getByLabelText(/Confirm Password/i), 'short')
    // Use form submit directly to bypass HTML5 minLength validation in test env
    await user.click(screen.getByRole('button', { name: /Reset Password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters.')
    })
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled()
  })
})
