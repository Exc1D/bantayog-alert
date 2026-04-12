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
      expect(screen.getByLabelText('severity-warning')).toBeInTheDocument()
    })

    it('shows severity indicator for emergency', () => {
      render(<AlertCard alert={{ ...mockAlert, severity: 'emergency' }} />)
      expect(screen.getByLabelText('severity-emergency')).toBeInTheDocument()
    })

    it('shows severity indicator for info', () => {
      render(<AlertCard alert={{ ...mockAlert, severity: 'info' }} />)
      expect(screen.getByLabelText('severity-info')).toBeInTheDocument()
    })
  })

  describe('Message Truncation', () => {
    it('should truncate long messages and show see more button', () => {
      render(<AlertCard alert={longMessageAlert} />)

      // Assert truncated text is actually displayed (first 150 chars + ellipsis)
      expect(screen.getByText(/^This is a very long alert message that exceeds the 150 character truncate limit\. It contains detailed information about the emergency situation and wh\.\.\./)).toBeInTheDocument()
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

  describe('Offline/Cached State', () => {
    it('should show cached indicator when isCached is true', () => {
      render(<AlertCard alert={mockAlert} isCached />)

      expect(screen.getByTestId('cached-indicator')).toBeInTheDocument()
      expect(screen.getByText('(cached)')).toBeInTheDocument()
    })

    it('should not show cached indicator when isCached is false', () => {
      render(<AlertCard alert={mockAlert} isCached={false} />)

      expect(screen.queryByTestId('cached-indicator')).not.toBeInTheDocument()
    })

    it('should not show cached indicator when isCached is not provided', () => {
      render(<AlertCard alert={mockAlert} />)

      expect(screen.queryByTestId('cached-indicator')).not.toBeInTheDocument()
    })
  })

  describe('Government Alert Fields', () => {
    describe('type icon', () => {
      it('should render evacuation type icon when alert.type === "evacuation"', () => {
        const alertWithType = { ...mockAlert, type: 'evacuation' as const }
        render(<AlertCard alert={alertWithType} />)
        expect(screen.getByLabelText('type-evacuation')).toBeInTheDocument()
      })

      it('should render weather type icon when alert.type === "weather"', () => {
        const alertWithType = { ...mockAlert, type: 'weather' as const }
        render(<AlertCard alert={alertWithType} />)
        expect(screen.getByLabelText('type-weather')).toBeInTheDocument()
      })

      it('should render health type icon when alert.type === "health"', () => {
        const alertWithType = { ...mockAlert, type: 'health' as const }
        render(<AlertCard alert={alertWithType} />)
        expect(screen.getByLabelText('type-health')).toBeInTheDocument()
      })

      it('should render infrastructure type icon when alert.type === "infrastructure"', () => {
        const alertWithType = { ...mockAlert, type: 'infrastructure' as const }
        render(<AlertCard alert={alertWithType} />)
        expect(screen.getByLabelText('type-infrastructure')).toBeInTheDocument()
      })

      it('should render info icon when alert.type === "other"', () => {
        const alertWithType = { ...mockAlert, type: 'other' as const }
        render(<AlertCard alert={alertWithType} />)
        expect(screen.getByLabelText('type-other')).toBeInTheDocument()
      })

      it('should not render type icon when alert.type is undefined', () => {
        render(<AlertCard alert={mockAlert} />)
        expect(screen.queryByLabelText(/^type-/)).not.toBeInTheDocument()
      })
    })

    describe('source badge', () => {
      it('should render MDRRMO badge with red background', () => {
        const alertWithSource = { ...mockAlert, source: 'MDRRMO' as const }
        render(<AlertCard alert={alertWithSource} />)
        const badge = screen.getByText('MDRRMO')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveClass('bg-red-100', 'text-red-800')
      })

      it('should render PAGASA badge with blue background', () => {
        const alertWithSource = { ...mockAlert, source: 'PAGASA' as const }
        render(<AlertCard alert={alertWithSource} />)
        const badge = screen.getByText('PAGASA')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
      })

      it('should render DOH badge with green background', () => {
        const alertWithSource = { ...mockAlert, source: 'DOH' as const }
        render(<AlertCard alert={alertWithSource} />)
        const badge = screen.getByText('DOH')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveClass('bg-green-100', 'text-green-800')
      })

      it('should render DPWH badge with yellow background', () => {
        const alertWithSource = { ...mockAlert, source: 'DPWH' as const }
        render(<AlertCard alert={alertWithSource} />)
        const badge = screen.getByText('DPWH')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
      })

      it('should render PHIVOLCS badge with orange background', () => {
        const alertWithSource = { ...mockAlert, source: 'PHIVOLCS' as const }
        render(<AlertCard alert={alertWithSource} />)
        const badge = screen.getByText('PHIVOLCS')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveClass('bg-orange-100', 'text-orange-800')
      })

      it('should render source badge as clickable link when sourceUrl is provided', async () => {
        const user = userEvent.setup()
        const alertWithSourceUrl = {
          ...mockAlert,
          source: 'MDRRMO' as const,
          sourceUrl: 'https://mdrmo.example.gov.ph/advisory',
        }
        render(<AlertCard alert={alertWithSourceUrl} />)

        const badge = screen.getByText('MDRRMO')
        expect(badge.closest('a')).toHaveAttribute(
          'href',
          'https://mdrmo.example.gov.ph/advisory'
        )
        expect(badge.closest('a')).toHaveAttribute('target', '_blank')

        await user.click(badge)
        expect(mockOpen).toHaveBeenCalledWith(
          'https://mdrmo.example.gov.ph/advisory',
          '_blank',
          'noopener,noreferrer'
        )
      })

      it('should not render source badge when alert.source is undefined', () => {
        render(<AlertCard alert={mockAlert} />)
        expect(screen.queryByText(/^(MDRRMO|PAGASA|DOH|DPWH|PHIVOLCS|Other)$/)).not.toBeInTheDocument()
      })
    })

    describe('affected areas', () => {
      it('should render affected municipalities as comma-separated list', () => {
        const alertWithAreas = {
          ...mockAlert,
          affectedAreas: {
            municipalities: ['daet', 'labo', 'jose_panganiban'],
          },
        }
        render(<AlertCard alert={alertWithAreas} />)
        expect(screen.getByText(/Affects: daet, labo, jose_panganiban/)).toBeInTheDocument()
      })

      it('should render affected barangays in parentheses when provided', () => {
        const alertWithBarangays = {
          ...mockAlert,
          affectedAreas: {
            municipalities: ['daet'],
            barangays: ['Bagasbas', 'Centro'],
          },
        }
        render(<AlertCard alert={alertWithBarangays} />)
        expect(screen.getByText(/Affects: daet \(Bagasbas, Centro\)/)).toBeInTheDocument()
      })

      it('should not render affected areas when alert.affectedAreas is undefined', () => {
        render(<AlertCard alert={mockAlert} />)
        expect(screen.queryByText(/^Affects:/)).not.toBeInTheDocument()
      })
    })
  })
})

