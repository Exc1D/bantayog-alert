/**
 * ReportDetailScreen Component Tests
 *
 * Tests the full report detail view with timeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReportDetailScreen } from '../ReportDetailScreen'
import { Report } from '@/shared/types/firestore.types'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ reportId: 'report-123' }),
  useNavigate: () => vi.fn(),
}))

// Mock firebase/firestore service
const mockGetDocument = vi.fn()
vi.mock('@/shared/services/firestore.service', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}))

// Mock the timeline component
vi.mock('../UpdateTimeline', () => ({
  UpdateTimeline: ({ entries }: { entries: unknown[] }) => (
    <div data-testid="update-timeline-mock">
      {entries.length === 0 ? (
        <span>No timeline entries</span>
      ) : (
        entries.map((e: { id: string }) => (
          <span key={e.id}>Timeline entry {e.id}</span>
        ))
      )}
    </div>
  ),
}))

const mockReport: Report = {
  id: 'report-123',
  createdAt: Date.now() - 7200000, // 2 hours ago
  updatedAt: Date.now() - 3600000,
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
  status: 'verified',
  description: 'Heavy flooding in the area. Water levels are rising rapidly.',
  isAnonymous: true,
  verifiedAt: Date.now() - 3600000,
  verifiedBy: 'admin-123',
}

describe('ReportDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render report detail structure', async () => {
    mockGetDocument.mockResolvedValue(mockReport)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('report-detail-screen')).toBeInTheDocument()
    })
  })

  it('should show loading state initially', () => {
    // Never resolve to keep loading state
    mockGetDocument.mockReturnValue(new Promise(() => {}))

    render(<ReportDetailScreen />)

    expect(screen.getByTestId('report-detail-loading')).toBeInTheDocument()
  })

  it('should show error state when report not found', async () => {
    mockGetDocument.mockResolvedValue(null)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('report-detail-error')).toBeInTheDocument()
    })
  })

  it('should display report details when loaded', async () => {
    mockGetDocument.mockResolvedValue(mockReport)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.getByText('Heavy flooding in the area. Water levels are rising rapidly.')).toBeInTheDocument()
    })

    expect(screen.getByText('Flood')).toBeInTheDocument()
    expect(screen.getByText('San Isidro, Daet')).toBeInTheDocument()
  })

  it('should display verified badge for verified reports', async () => {
    mockGetDocument.mockResolvedValue(mockReport)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('verified-badge')).toBeInTheDocument()
    })
  })

  it('should not display verified badge for unverified reports', async () => {
    const unverifiedReport = { ...mockReport, verifiedAt: undefined, verifiedBy: undefined }
    mockGetDocument.mockResolvedValue(unverifiedReport)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.queryByTestId('verified-badge')).not.toBeInTheDocument()
    })
  })

  it('should display timeline section', async () => {
    mockGetDocument.mockResolvedValue(mockReport)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('update-timeline-mock')).toBeInTheDocument()
    })
  })

  it('should display share button', async () => {
    mockGetDocument.mockResolvedValue(mockReport)

    render(<ReportDetailScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('share-button')).toBeInTheDocument()
    })
  })
})
