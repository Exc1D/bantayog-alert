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

// Mock usePushNotifications hook
const mockUsePushNotifications = vi.fn()
vi.mock('@/features/alerts/hooks/usePushNotifications', () => ({
  usePushNotifications: () => mockUsePushNotifications(),
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
    // Default mock returns
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUsePushNotifications.mockReturnValue({
      permission: 'default',
      isSupported: true,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
  })

  it('renders success message with Report ID', () => {
    render(<ReportSuccess {...defaultProps} />)

    expect(screen.getByText('Report submitted successfully!')).toBeInTheDocument()
    expect(screen.getByTestId('report-id')).toHaveTextContent('#2024-DAET-0471')
  })

  it('shows success icon', () => {
    render(<ReportSuccess {...defaultProps} />)

    const icon = screen.getByRole('img', { name: /success checkmark/i })
    expect(icon).toBeInTheDocument()
  })

  it('displays municipality in info text', () => {
    render(<ReportSuccess {...defaultProps} />)

    expect(screen.getByText(/Your report from Daet/)).toBeInTheDocument()
  })

  it('shows share button and calls onShare callback', async () => {
    render(<ReportSuccess {...defaultProps} />)

    const shareButton = screen.getByRole('button', { name: /share this alert/i })
    expect(shareButton).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(shareButton)

    expect(defaultProps.onShare).toHaveBeenCalledTimes(1)
  })

  it('shows create account button for anonymous users', () => {
    render(<ReportSuccess {...defaultProps} />)

    const createAccountButton = screen.getByRole('button', { name: /create account to track/i })
    expect(createAccountButton).toBeInTheDocument()
  })

  it('calls onCreateAccount callback when button clicked', async () => {
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
    render(<ReportSuccess {...defaultProps} />)

    const navButton = screen.getByRole('button', { name: /return to feed\/map/i })
    expect(navButton).toBeInTheDocument()
  })

  it('calls onNavigate callback when navigation button clicked', async () => {
    render(<ReportSuccess {...defaultProps} />)

    const navButton = screen.getByRole('button', { name: /return to feed\/map/i })
    const user = userEvent.setup()
    await user.click(navButton)

    expect(defaultProps.onNavigate).toHaveBeenCalledTimes(1)
  })

  it('does not show navigation button when onNavigate not provided', () => {
    const props = { ...defaultProps, onNavigate: undefined }
    render(<ReportSuccess {...props} />)

    const navButton = screen.queryByRole('button', { name: /return to feed\/map/i })
    expect(navButton).not.toBeInTheDocument()
  })

  it('formats report ID with # prefix', () => {
    render(<ReportSuccess {...defaultProps} />)

    const reportIdElement = screen.getByTestId('report-id')
    expect(reportIdElement).toHaveTextContent('#2024-DAET-0471')
  })

  it('displays tracking message for anonymous users', () => {
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

  describe('Push Notification Prompt', () => {
    it('does not show notification prompt when isFirstReport is false', () => {
      render(<ReportSuccess {...defaultProps} isFirstReport={false} />)

      expect(screen.queryByTestId('notification-prompt')).not.toBeInTheDocument()
    })

    it('does not show notification prompt when permission is already granted', () => {
      mockUsePushNotifications.mockReturnValue({
        permission: 'granted',
        isSupported: true,
        requestPermission: vi.fn(),
      })

      render(<ReportSuccess {...defaultProps} isFirstReport />)

      expect(screen.queryByTestId('notification-prompt')).not.toBeInTheDocument()
    })

    it('does not show notification prompt when notifications are not supported', () => {
      mockUsePushNotifications.mockReturnValue({
        permission: 'denied',
        isSupported: false,
        requestPermission: vi.fn(),
      })

      render(<ReportSuccess {...defaultProps} isFirstReport />)

      expect(screen.queryByTestId('notification-prompt')).not.toBeInTheDocument()
    })

    it('shows notification prompt when isFirstReport and permission not granted', () => {
      mockUsePushNotifications.mockReturnValue({
        permission: 'default',
        isSupported: true,
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })

      render(<ReportSuccess {...defaultProps} isFirstReport />)

      expect(screen.getByTestId('notification-prompt')).toBeInTheDocument()
      expect(screen.getByText(/Get notified when your report is verified/i)).toBeInTheDocument()
      expect(screen.getByTestId('enable-notifications-button')).toBeInTheDocument()
    })

    it('calls requestPermission when enable notifications button is clicked', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted')
      mockUsePushNotifications.mockReturnValue({
        permission: 'default',
        isSupported: true,
        requestPermission: mockRequestPermission,
      })

      render(<ReportSuccess {...defaultProps} isFirstReport />)

      const user = userEvent.setup()
      await user.click(screen.getByTestId('enable-notifications-button'))

      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    })
  })

  describe('isQueued', () => {
    it('shows queued heading when isQueued is true', () => {
      render(<ReportSuccess {...defaultProps} isQueued />)

      expect(screen.getByText('Report queued for submission')).toBeInTheDocument()
      expect(screen.queryByText('Report submitted successfully!')).not.toBeInTheDocument()
    })

    it('shows queued info text when isQueued is true', () => {
      render(<ReportSuccess {...defaultProps} isQueued />)

      expect(
        screen.getByText(/Your report from Daet has been queued and will be submitted automatically/i)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/Your report from Daet has been submitted and will be reviewed/)
      ).not.toBeInTheDocument()
    })

    it('shows report queued icon label when isQueued is true', () => {
      render(<ReportSuccess {...defaultProps} isQueued />)

      const icon = screen.getByRole('img', { name: /report queued/i })
      expect(icon).toBeInTheDocument()
    })
  })
})
