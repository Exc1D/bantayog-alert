/**
 * AlertCard Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertCard } from '../AlertCard'
import type { Alert } from '@/shared/types/firestore.types'

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
  value: mockOpen,
  writable: true,
})

const mockAlert: Alert = {
  id: 'alert-1',
  createdAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
  targetAudience: 'all',
  title: 'TYPHOON WARNING',
  message: 'Typhoon approaching Camarines Norte',
  severity: 'warning',
  deliveryMethod: ['push', 'in_app'],
  createdBy: 'admin-123',
}

const longMessageAlert: Alert = {
  ...mockAlert,
  id: 'alert-long',
  message:
    'This is a very long alert message that exceeds the 150 character truncate limit. ' +
    'It contains detailed information about the emergency situation and what actions ' +
    'residents should take. This additional text ensures the message is long enough to trigger ' +
    'the truncation feature and display the See more button.',
}

describe('AlertCard', () => {
  beforeEach(() => {
    mockOpen.mockClear()
  })

  describe('Basic Rendering', () => {
    it('renders alert title', () => {
      render(<AlertCard alert={mockAlert} />)
      expect(screen.getByText('TYPHOON WARNING')).toBeInTheDocument()
    })

    it('renders alert message', () => {
      render(<AlertCard alert={mockAlert} />)
      expect(screen.getByText(/typhoon approaching/i)).toBeInTheDocument()
    })

    it('renders relative time', () => {
      render(<AlertCard alert={mockAlert} />)
      // 30 min ago → "30m ago" (shared formatTimeAgo short format)
      expect(screen.getByText('30m ago')).toBeInTheDocument()
    })

    it('shows severity indicator for warning', () => {
      render(<AlertCard alert={mockAlert} />)
      expect(screen.getByText('⚠️')).toBeInTheDocument()
    })

    it('shows severity indicator for emergency', () => {
      render(<AlertCard alert={{ ...mockAlert, severity: 'emergency' }} />)
      expect(screen.getByText('🔴')).toBeInTheDocument()
    })

    it('shows severity indicator for info', () => {
      render(<AlertCard alert={{ ...mockAlert, severity: 'info' }} />)
      expect(screen.getByText('ℹ️')).toBeInTheDocument()
    })
  })

  describe('Message Truncation', () => {
    it('should truncate long messages and show see more button', () => {
      render(<AlertCard alert={longMessageAlert} />)

      expect(screen.getByTestId('see-more-button')).toBeInTheDocument()
      expect(screen.getByText(/See more/)).toBeInTheDocument()
    })

    it('should expand message when see more is clicked', async () => {
      const user = userEvent.setup()
      render(<AlertCard alert={longMessageAlert} />)

      const seeMoreButton = screen.getByTestId('see-more-button')
      expect(seeMoreButton).toHaveTextContent('See more')

      await user.click(seeMoreButton)

      await waitFor(() => {
        expect(seeMoreButton).toHaveTextContent('See less')
      })
    })

    it('should collapse message when see less is clicked', async () => {
      const user = userEvent.setup()
      render(<AlertCard alert={longMessageAlert} />)

      const seeMoreButton = screen.getByTestId('see-more-button')

      // First expand
      await user.click(seeMoreButton)
      await waitFor(() => {
        expect(seeMoreButton).toHaveTextContent('See less')
      })

      // Then collapse
      await user.click(seeMoreButton)
      await waitFor(() => {
        expect(seeMoreButton).toHaveTextContent('See more')
      })
    })

    it('should not show see more button for short messages', () => {
      render(<AlertCard alert={mockAlert} />)
      expect(screen.queryByTestId('see-more-button')).not.toBeInTheDocument()
    })
  })

  describe('Read More Link', () => {
    it('should show read more link when linkUrl exists', () => {
      const alertWithLink = { ...mockAlert, linkUrl: 'https://example.com' }
      render(<AlertCard alert={alertWithLink} />)

      expect(screen.getByTestId('read-more-link')).toBeInTheDocument()
      expect(screen.getByText(/Read More/)).toBeInTheDocument()
    })

    it('should not show read more link when linkUrl is missing', () => {
      render(<AlertCard alert={mockAlert} />)

      expect(screen.queryByTestId('read-more-link')).not.toBeInTheDocument()
    })

    it('should open link in new tab when read more is clicked', async () => {
      const user = userEvent.setup()
      const alertWithLink = {
        ...mockAlert,
        linkUrl: 'https://pagasa.dost.gov.ph',
      }
      render(<AlertCard alert={alertWithLink} />)

      const readMoreLink = screen.getByTestId('read-more-link')
      await user.click(readMoreLink)

      expect(mockOpen).toHaveBeenCalledWith(
        'https://pagasa.dost.gov.ph',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('Accessibility', () => {
    it('should have correct severity aria-label', () => {
      render(<AlertCard alert={mockAlert} />)

      const severityIcon = screen.getByLabelText('severity-warning')
      expect(severityIcon).toBeInTheDocument()
    })

    it('should have emergency severity aria-label', () => {
      render(<AlertCard alert={{ ...mockAlert, severity: 'emergency' }} />)

      const severityIcon = screen.getByLabelText('severity-emergency')
      expect(severityIcon).toBeInTheDocument()
    })

    it('should have info severity aria-label', () => {
      render(<AlertCard alert={{ ...mockAlert, severity: 'info' }} />)

      const severityIcon = screen.getByLabelText('severity-info')
      expect(severityIcon).toBeInTheDocument()
    })
  })
})

