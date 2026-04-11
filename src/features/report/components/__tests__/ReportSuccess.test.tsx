/**
 * ReportSuccess Component Tests
 *
 * Tests the success confirmation screen displayed after report submission.
 * Verifies Report ID formatting, conditional rendering based on auth state,
 * and callback functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock useAuth hook
const mockUseAuth = vi.fn()
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

// Import after mocking
import { ReportSuccess } from '../ReportSuccess'

describe('ReportSuccess', () => {
  const defaultProps = {
    reportId: '2024-DAET-0471',
    municipality: 'Daet',
    onCreateAccount: vi.fn(),
    onShare: vi.fn(),
    onNavigate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders success message with Report ID', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    expect(screen.getByText('Report submitted successfully!')).toBeInTheDocument()
    expect(screen.getByTestId('report-id')).toHaveTextContent('#2024-DAET-0471')
  })

  it('shows success icon', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const icon = screen.getByRole('img', { name: /success checkmark/i })
    expect(icon).toBeInTheDocument()
  })

  it('displays municipality in info text', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    expect(screen.getByText(/Your report from Daet/)).toBeInTheDocument()
  })

  it('shows share button and calls onShare callback', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const shareButton = screen.getByRole('button', { name: /share this alert/i })
    expect(shareButton).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(shareButton)

    expect(defaultProps.onShare).toHaveBeenCalledTimes(1)
  })

  it('shows create account button for anonymous users', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const createAccountButton = screen.getByRole('button', { name: /create account to track/i })
    expect(createAccountButton).toBeInTheDocument()
  })

  it('calls onCreateAccount callback when button clicked', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const createAccountButton = screen.getByRole('button', { name: /create account to track/i })
    const user = userEvent.setup()
    await user.click(createAccountButton)

    expect(defaultProps.onCreateAccount).toHaveBeenCalledTimes(1)
  })

  it('hides create account button for authenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-123', email: 'user@example.com' },
      loading: false,
    })

    render(<ReportSuccess {...defaultProps} />)

    const createAccountButton = screen.queryByRole('button', { name: /create account to track/i })
    expect(createAccountButton).not.toBeInTheDocument()
  })

  it('shows navigation button when onNavigate provided', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const navButton = screen.getByRole('button', { name: /return to feed\/map/i })
    expect(navButton).toBeInTheDocument()
  })

  it('calls onNavigate callback when navigation button clicked', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const navButton = screen.getByRole('button', { name: /return to feed\/map/i })
    const user = userEvent.setup()
    await user.click(navButton)

    expect(defaultProps.onNavigate).toHaveBeenCalledTimes(1)
  })

  it('does not show navigation button when onNavigate not provided', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    const props = { ...defaultProps, onNavigate: undefined }
    render(<ReportSuccess {...props} />)

    const navButton = screen.queryByRole('button', { name: /return to feed\/map/i })
    expect(navButton).not.toBeInTheDocument()
  })

  it('formats report ID with # prefix', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    const reportIdElement = screen.getByTestId('report-id')
    expect(reportIdElement).toHaveTextContent('#2024-DAET-0471')
  })

  it('displays tracking message for anonymous users', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReportSuccess {...defaultProps} />)

    expect(screen.getByText(/Create an account to track updates/)).toBeInTheDocument()
  })

  it('hides tracking message for authenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-123', email: 'user@example.com' },
      loading: false,
    })

    render(<ReportSuccess {...defaultProps} />)

    expect(screen.queryByText(/Create an account to track updates/)).not.toBeInTheDocument()
  })
})
