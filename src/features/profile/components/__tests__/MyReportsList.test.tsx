/**
 * MyReportsList Component Tests
 *
 * Tests fetching and displaying user's submitted reports:
 * - Registered reports (reporterUserId === userId)
 * - Linked anonymous reports (reporterPhone === user's phone)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { MyReportsList } from '../MyReportsList'
import { Timestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Mock useNavigate
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ---------------------------------------------------------------------------
// Stable mock for getDocs — hoisted before vi.mock
// ---------------------------------------------------------------------------
const mockGetDocs = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: mockGetDocs,
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
}))

// ---------------------------------------------------------------------------
// Helper: create a mock Firestore document snapshot
// ---------------------------------------------------------------------------
function createMockDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  }
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
function createReport(overrides: {
  reportId?: string
  incidentType?: string
  status?: 'pending' | 'verified' | 'resolved' | 'rejected'
  createdAt?: Date
  reporterUserId?: string
  reporterPhone?: string
  barangay?: string
  municipality?: string
} = {}) {
  return {
    reportId: `report-${Math.random().toString(36).slice(2)}`,
    incidentType: 'fire',
    status: 'pending' as const,
    createdAt: new Date(),
    reporterUserId: '',
    reporterPhone: '',
    barangay: 'Barangay 1',
    municipality: 'Daet',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------
const renderWithRouter = (userId: string, userPhone?: string) =>
  render(
    <BrowserRouter>
      <MyReportsList userId={userId} userPhone={userPhone} />
    </BrowserRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
  mockGetDocs.mockReset()
  mockGetDocs.mockResolvedValue({ docs: [], forEach: () => {} })
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
describe('MyReportsList loading state', () => {
  it('should show loading skeleton while fetching', () => {
    mockGetDocs.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    renderWithRouter('user-123')
    // Loading skeleton has animate-pulse class on skeleton items
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
describe('MyReportsList empty state', () => {
  it('should show empty state when no reports exist', async () => {
    mockGetDocs.mockResolvedValue({ docs: [], forEach: () => {} })
    renderWithRouter('user-123')

    await waitFor(() => {
      expect(screen.getByText(/no reports yet/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
describe('MyReportsList error state', () => {
  it('should show error message when fetch fails', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'))
    renderWithRouter('user-123')

    await waitFor(() => {
      expect(screen.getByText(/failed to load reports/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Registered reports (reporterUserId === userId)
// ---------------------------------------------------------------------------
describe('MyReportsList registered reports', () => {
  it('should display registered reports for matching userId', async () => {
    const report = createReport({
      reportId: 'report-reg-001',
      reporterUserId: 'user-123',
      incidentType: 'fire',
      status: 'pending',
      barangay: 'Mabuhay',
      municipality: 'Daet',
    })

    mockGetDocs.mockResolvedValue({
      docs: [
        createMockDoc('doc-1', {
          reportId: report.reportId,
          reporterUserId: report.reporterUserId,
          incidentType: report.incidentType,
          status: report.status,
          createdAt: Timestamp.fromDate(report.createdAt),
          barangay: report.barangay,
          municipality: report.municipality,
        }),
      ],
      forEach: function (fn: (doc: unknown) => void) {
        this.docs.forEach(fn)
      },
    })

    renderWithRouter('user-123')

    await waitFor(() => {
      expect(screen.getByText(/fire/i)).toBeInTheDocument()
      expect(screen.getByText(/Mabuhay, Daet/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Linked anonymous reports (reporterPhone === userPhone)
// ---------------------------------------------------------------------------
describe('MyReportsList linked anonymous reports', () => {
  it('should display linked reports for matching phone', async () => {
    const report = createReport({
      reportId: 'report-anon-001',
      reporterPhone: '09123456789',
      incidentType: 'flood',
      status: 'verified',
      barangay: 'Calasumanga',
      municipality: 'Labo',
    })

    // First call (registered reports) returns empty
    // Second call (anonymous reports) returns the linked report
    let callCount = 0
    mockGetDocs.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({ docs: [], forEach: () => {} })
      }
      return Promise.resolve({
        docs: [
          createMockDoc('doc-2', {
            reportId: report.reportId,
            reporterPhone: report.reporterPhone,
            incidentType: report.incidentType,
            status: report.status,
            createdAt: Timestamp.fromDate(report.createdAt),
            barangay: report.barangay,
            municipality: report.municipality,
          }),
        ],
        forEach: function (fn: (doc: unknown) => void) {
          this.docs.forEach(fn)
        },
      })
    })

    renderWithRouter('user-456', '09123456789')

    await waitFor(() => {
      expect(screen.getByText(/flood/i)).toBeInTheDocument()
      expect(screen.getByText(/Calasumanga, Labo/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Status grouping and badges
// ---------------------------------------------------------------------------
describe('MyReportsList status grouping', () => {
  it('should group reports by status and show correct badges', async () => {
    const reports = [
      createReport({ reportId: 'r1', status: 'pending' }),
      createReport({ reportId: 'r2', status: 'pending' }),
      createReport({ reportId: 'r3', status: 'verified' }),
      createReport({ reportId: 'r4', status: 'resolved' }),
      createReport({ reportId: 'r5', status: 'rejected' }),
    ]

    // Both queries return reports
    mockGetDocs.mockResolvedValue({
      docs: reports.map((r, i) =>
        createMockDoc(`doc-${i}`, {
          reportId: r.reportId,
          incidentType: r.incidentType,
          status: r.status,
          createdAt: Timestamp.fromDate(r.createdAt),
          barangay: r.barangay,
          municipality: r.municipality,
        })
      ),
      forEach: function (fn: (doc: unknown) => void) {
        this.docs.forEach(fn)
      },
    })

    renderWithRouter('user-123')

    await waitFor(() => {
      // Use getAllByText since badges and headings both have the same text
      expect(screen.getAllByText(/^Pending$/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/^Verified$/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/^Resolved$/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/^Rejected$/).length).toBeGreaterThanOrEqual(1)
    })
  })
})

// ---------------------------------------------------------------------------
// Navigation on View button click
// ---------------------------------------------------------------------------
describe('MyReportsList navigation', () => {
  it('should navigate to report detail when View is clicked', async () => {
    const report = createReport({
      reportId: 'report-detail-001',
      reporterUserId: 'user-123',
    })

    mockGetDocs.mockResolvedValue({
      docs: [
        createMockDoc('doc-1', {
          reportId: report.reportId,
          reporterUserId: report.reporterUserId,
          incidentType: report.incidentType,
          status: report.status,
          createdAt: Timestamp.fromDate(report.createdAt),
          barangay: report.barangay,
          municipality: report.municipality,
        }),
      ],
      forEach: function (fn: (doc: unknown) => void) {
        this.docs.forEach(fn)
      },
    })

    const user = userEvent.setup()
    renderWithRouter('user-123')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /view/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/feed/report-detail-001')
  })
})
