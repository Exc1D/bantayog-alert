/**
 * FeedCard Component Tests
 *
 * Tests the Facebook-style report card component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FeedCard } from '../FeedCard'
import { Report } from '@/shared/types/firestore.types'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const mockReport: Report = {
  id: 'report-123',
  createdAt: Date.now() - 3600000, // 1 hour ago
  updatedAt: Date.now(),
  approximateLocation: {
    barangay: 'San Isidro',
    municipality: 'Daet',
    approximateCoordinates: {
      latitude: 14.1234,
      longitude: 122.5678,
    },
  },
  incidentType: 'flood',
  severity: 'high',
  status: 'pending',
  description: 'This is a test report description that is long enough to test the truncation feature and see more button functionality in the FeedCard component. This additional text makes it longer than 150 characters.',
  isAnonymous: true,
  verifiedAt: Date.now() - 1800000, // Verified 30 mins ago
  verifiedBy: 'admin-123',
}

const mockActions = {
  onLike: vi.fn(),
  onComment: vi.fn(),
  onShare: vi.fn(),
  onLocationClick: vi.fn(),
}

describe('FeedCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render report card structure', () => {
    render(<FeedCard report={mockReport} />)

    expect(screen.getByTestId(`feed-card-${mockReport.id}`)).toBeInTheDocument()
  })

  describe('Header Section', () => {
    it('should display anonymous citizen name', () => {
      render(<FeedCard report={mockReport} />)

      expect(screen.getByText('Anonymous Citizen')).toBeInTheDocument()
    })

    it('should display non-anonymous reporter name', () => {
      const report = { ...mockReport, isAnonymous: false }
      render(<FeedCard report={report} />)

      expect(screen.getByText('Citizen Reporter')).toBeInTheDocument()
    })

    it('should display verified badge for verified reports', () => {
      render(<FeedCard report={mockReport} />)

      expect(screen.getByTestId('verified-badge')).toBeInTheDocument()
    })

    it('should not display verified badge for unverified reports', () => {
      const report = { ...mockReport, verifiedAt: undefined }
      render(<FeedCard report={report} />)

      expect(screen.queryByTestId('verified-badge')).not.toBeInTheDocument()
    })

    it('should display status badge', () => {
      render(<FeedCard report={mockReport} />)

      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('should display severity badge', () => {
      render(<FeedCard report={mockReport} />)

      const badge = screen.getByTestId('severity-badge')
      expect(badge).toHaveTextContent('HIGH')
    })

    it('should display relative time (e.g. "1h ago")', () => {
      render(<FeedCard report={mockReport} />)

      // mockReport.createdAt is 1 hour ago
      expect(screen.getByText(/1h ago/)).toBeInTheDocument()
    })
  })

  describe('Content Section', () => {
    it('should display incident type badge', () => {
      render(<FeedCard report={mockReport} />)

      const badge = screen.getByTestId('type-badge')
      expect(badge).toHaveTextContent('Flood')
    })

    it('should display report description', () => {
      render(<FeedCard report={mockReport} />)

      const description = screen.getByTestId('report-description')
      expect(description).toBeInTheDocument()
    })

    it('should truncate long descriptions and show see more button', () => {
      render(<FeedCard report={mockReport} />)

      expect(screen.getByTestId('see-more-button')).toBeInTheDocument()
      expect(screen.queryByTestId('see-less-button')).not.toBeInTheDocument()
    })

    it('should expand description when see more is clicked', async () => {
      render(<FeedCard report={mockReport} />)

      const seeMoreButton = screen.getByTestId('see-more-button')
      fireEvent.click(seeMoreButton)

      await waitFor(() => {
        expect(screen.getByTestId('see-less-button')).toBeInTheDocument()
        expect(screen.queryByTestId('see-more-button')).not.toBeInTheDocument()
      })
    })

    it('should collapse description when see less is clicked', async () => {
      render(<FeedCard report={mockReport} />)

      // First expand
      fireEvent.click(screen.getByTestId('see-more-button'))

      await waitFor(() => {
        expect(screen.getByTestId('see-less-button')).toBeInTheDocument()
      })

      // Then collapse
      fireEvent.click(screen.getByTestId('see-less-button'))

      await waitFor(() => {
        expect(screen.getByTestId('see-more-button')).toBeInTheDocument()
        expect(screen.queryByTestId('see-less-button')).not.toBeInTheDocument()
      })
    })

    it('should not show see more button for short descriptions', () => {
      const shortReport = { ...mockReport, description: 'Short description' }
      render(<FeedCard report={shortReport} />)

      expect(screen.queryByTestId('see-more-button')).not.toBeInTheDocument()
    })
  })

  describe('Footer Section', () => {
    it('should display location button with barangay and municipality', () => {
      render(<FeedCard report={mockReport} />)

      const locationButton = screen.getByTestId('location-button')
      expect(locationButton).toHaveTextContent('San Isidro, Daet')
    })

    it('should call onLocationClick when location is clicked', () => {
      render(<FeedCard report={mockReport} actions={mockActions} />)

      const locationButton = screen.getByTestId('location-button')
      fireEvent.click(locationButton)

      expect(mockActions.onLocationClick).toHaveBeenCalledWith(
        mockReport.approximateLocation.approximateCoordinates.latitude,
        mockReport.approximateLocation.approximateCoordinates.longitude
      )
    })

    it('should display like count when greater than 0', () => {
      render(<FeedCard report={mockReport} likeCount={5} />)

      expect(screen.getByTestId('like-count')).toHaveTextContent('5')
    })

    it('should not display like count when 0', () => {
      render(<FeedCard report={mockReport} likeCount={0} />)

      expect(screen.queryByTestId('like-count')).not.toBeInTheDocument()
    })

    it('should display comment count when greater than 0', () => {
      render(<FeedCard report={mockReport} commentCount={12} />)

      expect(screen.getByTestId('comment-count')).toHaveTextContent('12 comments')
    })

    it('should not display comment count when 0', () => {
      render(<FeedCard report={mockReport} commentCount={0} />)

      expect(screen.queryByTestId('comment-count')).not.toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('should render all action buttons', () => {
      render(<FeedCard report={mockReport} />)

      expect(screen.getByTestId('like-button')).toBeInTheDocument()
      expect(screen.getByTestId('comment-button')).toBeInTheDocument()
      expect(screen.getByTestId('share-button')).toBeInTheDocument()
    })

    it('should call onLike when like button is clicked', () => {
      render(<FeedCard report={mockReport} actions={mockActions} />)

      const likeButton = screen.getByTestId('like-button')
      fireEvent.click(likeButton)

      expect(mockActions.onLike).toHaveBeenCalledWith(mockReport.id)
    })

    it('should toggle like state when clicked', () => {
      render(<FeedCard report={mockReport} actions={mockActions} />)

      const likeButton = screen.getByTestId('like-button')

      // Initial state: not liked
      expect(likeButton).not.toHaveClass('text-red-500')

      // Click to like
      fireEvent.click(likeButton)
      expect(likeButton).toHaveClass('text-red-500')

      // Click to unlike
      fireEvent.click(likeButton)
      expect(likeButton).not.toHaveClass('text-red-500')
    })

    it('should display liked state when isLiked prop is true', () => {
      render(<FeedCard report={mockReport} isLiked={true} />)

      const likeButton = screen.getByTestId('like-button')
      expect(likeButton).toHaveClass('text-red-500')
    })

    it('should call onComment when comment button is clicked', () => {
      render(<FeedCard report={mockReport} actions={mockActions} />)

      const commentButton = screen.getByTestId('comment-button')
      fireEvent.click(commentButton)

      expect(mockActions.onComment).toHaveBeenCalledWith(mockReport.id)
    })

    it('should call onShare when share button is clicked', () => {
      render(<FeedCard report={mockReport} actions={mockActions} />)

      const shareButton = screen.getByTestId('share-button')
      fireEvent.click(shareButton)

      expect(mockActions.onShare).toHaveBeenCalledWith(mockReport.id)
    })
  })

  describe('Styling and Accessibility', () => {
    it('should apply correct severity colors', () => {
      const { rerender } = render(<FeedCard report={mockReport} />)

      const testSeverity = (severity: string, expectedClass: string) => {
        const report = { ...mockReport, severity }
        rerender(<FeedCard report={report} />)
        const badge = screen.getByTestId('severity-badge')
        expect(badge).toHaveClass(expectedClass)
      }

      testSeverity('low', 'bg-gray-100')
      testSeverity('medium', 'bg-yellow-100')
      testSeverity('high', 'bg-orange-100')
      testSeverity('critical', 'bg-red-100')
    })

    it('should apply correct incident type colors', () => {
      const { rerender } = render(<FeedCard report={mockReport} />)

      const testType = (type: string, expectedClass: string) => {
        const report = { ...mockReport, incidentType: type }
        rerender(<FeedCard report={report} />)
        const badge = screen.getByTestId('type-badge')
        expect(badge).toHaveClass(expectedClass)
      }

      testType('flood', 'bg-blue-100')
      testType('fire', 'bg-red-100')
      testType('earthquake', 'bg-amber-100')
    })
  })

  describe('Edge Cases', () => {
    it('should handle report without verification', () => {
      const report = { ...mockReport, verifiedAt: undefined, verifiedBy: undefined }
      render(<FeedCard report={report} />)

      expect(screen.queryByTestId('verified-badge')).not.toBeInTheDocument()
    })

    it('should handle report with resolution notes', () => {
      const report = {
        ...mockReport,
        status: 'resolved' as const,
        resolvedAt: Date.now(),
        resolvedBy: 'responder-123',
        resolutionNotes: 'Road has been cleared',
      }
      render(<FeedCard report={report} />)

      expect(screen.getByText('Resolved')).toBeInTheDocument()
    })

    it('should handle all incident types', () => {
      const types = [
        'flood',
        'earthquake',
        'landslide',
        'fire',
        'typhoon',
        'medical_emergency',
        'accident',
        'infrastructure',
        'crime',
        'other',
      ] as const

      types.forEach((type) => {
        const report = { ...mockReport, incidentType: type }
        const { unmount } = render(<FeedCard report={report} />)

        expect(screen.getByTestId('type-badge')).toBeInTheDocument()
        unmount()
      })
    })
  })
})
