import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockGetSession = vi.hoisted(() => vi.fn())
const mockGenerateSecret = vi.hoisted(() => vi.fn())
const mockAssertionForEnrollment = vi.hoisted(() => vi.fn())
const mockEnroll = vi.hoisted(() => vi.fn())
const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('firebase/auth', () => ({
  multiFactor: () => ({
    getSession: mockGetSession,
    enroll: mockEnroll,
  }),
  TotpMultiFactorGenerator: {
    generateSecret: mockGenerateSecret,
    assertionForEnrollment: mockAssertionForEnrollment,
  },
}))

vi.mock('../app/firebase', () => ({
  auth: {
    currentUser: { uid: 'uid-1', email: 'responder@test.com' },
  },
}))

import { TotpEnrollmentPage } from './TotpEnrollmentPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <TotpEnrollmentPage />
    </MemoryRouter>,
  )
}

describe('TotpEnrollmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue('mock-session')
    mockGenerateSecret.mockResolvedValue({
      secretKey: 'ABCDEFGHIJKLMNOP',
      generateQrCodeUrl: () =>
        'otpauth://totp/Bantayog%20Alert:responder@test.com?secret=ABCDEFGHIJKLMNOP',
    })
    mockAssertionForEnrollment.mockReturnValue({ type: 'totp' })
    mockEnroll.mockResolvedValue(undefined)
  })

  it('renders the heading for TOTP setup', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Set Up Two-Factor Authentication/i,
    )
  })

  it('does not show a Skip or Later button (enrollment is mandatory)', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /skip|later/i })).not.toBeInTheDocument()
  })

  it('shows Generate QR Code button on first step', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /generate qr code/i })).toBeInTheDocument()
  })

  it('generates session and secret when Generate QR Code is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(1)
      expect(mockGenerateSecret).toHaveBeenCalledWith('mock-session')
    })
  })

  it('shows the raw secret key for manual entry after generating', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))

    await waitFor(() => {
      expect(screen.getByText('ABCDEFGHIJKLMNOP')).toBeInTheDocument()
    })
  })

  it('advances to verification step when Next is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))
    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
  })

  it('verify button is disabled when code length is less than 6', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))
    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    const input = screen.getByLabelText(/6-digit code/i)
    await user.type(input, '123')

    expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled()
  })

  it('calls enroll with assertion when Verify is clicked with valid code', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))
    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    const input = screen.getByLabelText(/6-digit code/i)
    await user.type(input, '123456')

    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockAssertionForEnrollment).toHaveBeenCalledTimes(1)
      expect(mockEnroll).toHaveBeenCalledTimes(1)
    })
  })

  it('shows inline error when enrollment fails', async () => {
    mockEnroll.mockRejectedValueOnce(new Error('Invalid TOTP code. Please try again.'))

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))
    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    const input = screen.getByLabelText(/6-digit code/i)
    await user.type(input, '999999')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid|try again/i)
    })
  })

  it('navigates to / after successful enrollment and saving recovery codes', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate qr code/i }))
    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    const input = screen.getByLabelText(/6-digit code/i)
    await user.type(input, '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
