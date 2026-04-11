import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportDetailModal } from '../ReportDetailModal'
import { MemoryRouter } from 'react-router-dom'
import type { Report } from '@/shared/types/firestore.types'

// Mock the firestore service
const mockGetDocument = vi.fn()
vi.mock('@/shared/services/firestore.service', () => ({
  getDocument: () => mockGetDocument(),
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ReportDetailModal', () => {
  const mockReport: Report = {
    id: 'report-123',
    createdAt: Date.now() - 3600000, // 1 hour ago
    updatedAt: Date.now(),
    approximateLocation: {
      barangay: 'Brgy. 1',
      municipality: 'Daet',
      approximateCoordinates: {
        latitude: 14.5995,
        longitude: 120.9842,
      },
    },
    incidentType: 'flood',
    severity: 'high',
    status: 'verified',
    description: 'Heavy flooding in the area',
    isAnonymous: true,
    verifiedAt: Date.now() - 1800000, // 30 minutes ago
    verifiedBy: 'admin-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocument.mockReset()
  })

  describe('when reportId is null', () => {
    it('should not render modal', () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId={null} onClose={vi.fn()} />
        </MemoryRouter>
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('when reportId is provided', () => {
    it('should render modal', () => {
      mockGetDocument.mockResolvedValue(mockReport)

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Report Details')).toBeInTheDocument()
    })

    it('should show loading skeleton while fetching', () => {
      mockGetDocument.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      expect(screen.getByTestId('report-loading')).toBeInTheDocument()
    })
  })

  describe('when report fetch succeeds', () => {
    beforeEach(() => {
      mockGetDocument.mockResolvedValue(mockReport)
    })

    it('should display report type and severity', async () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Flood')).toBeInTheDocument()
        expect(screen.getByText('HIGH')).toBeInTheDocument()
      })
    })

    it('should display report description', async () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Heavy flooding in the area')).toBeInTheDocument()
      })
    })

    it('should display location', async () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Brgy. 1, Daet')).toBeInTheDocument()
      })
    })

    it('should display relative time', async () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/hour/)).toBeInTheDocument()
      })
    })

    it('should display verification info if verified', async () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeInTheDocument()
      })
    })

    it('should display View in Feed and Close buttons', async () => {
      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /view in feed/i })
        ).toBeInTheDocument()
        expect(
          screen.getByTestId('close-modal-button')
        ).toBeInTheDocument()
      })
    })
  })

  describe('when View in Feed button is clicked', () => {
    it('should navigate to feed detail and close modal', async () => {
      const onClose = vi.fn()
      mockGetDocument.mockResolvedValue(mockReport)

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={onClose} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /view in feed/i })
        ).toBeInTheDocument()
      })

      const viewButton = screen.getByRole('button', { name: /view in feed/i })
      await userEvent.click(viewButton)

      expect(mockNavigate).toHaveBeenCalledWith('/feed/report-123')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('when Close button is clicked', () => {
    it('should call onClose', async () => {
      const onClose = vi.fn()
      mockGetDocument.mockResolvedValue(mockReport)

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={onClose} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByTestId('close-modal-button')
        ).toBeInTheDocument()
      })

      const closeButton = screen.getByTestId('close-modal-button')
      await userEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('when report fetch fails', () => {
    it('should display error message', async () => {
      mockGetDocument.mockRejectedValue(
        new Error('Failed to fetch')
      )

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('report-error')).toBeInTheDocument()
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
      })
    })
  })

  describe('when report is not found', () => {
    it('should display not found error', async () => {
      mockGetDocument.mockResolvedValue(null)

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="nonexistent" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('report-error')).toBeInTheDocument()
        expect(screen.getByText(/not found/i)).toBeInTheDocument()
      })
    })
  })

  describe('formatting helpers', () => {
    beforeEach(() => {
      mockGetDocument.mockResolvedValue(mockReport)
    })

    it('should format incident type correctly', async () => {
      const medicalReport = {
        ...mockReport,
        incidentType: 'medical_emergency' as const,
      }
      mockGetDocument.mockResolvedValue(medicalReport)

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Emergency')).toBeInTheDocument()
      })
    })

    it('should format status correctly', async () => {
      const falseAlarmReport = {
        ...mockReport,
        status: 'false_alarm' as const,
      }
      mockGetDocument.mockResolvedValue(falseAlarmReport)

      render(
        <MemoryRouter>
          <ReportDetailModal reportId="report-123" onClose={vi.fn()} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('FALSE ALARM')).toBeInTheDocument()
      })
    })
  })
})
