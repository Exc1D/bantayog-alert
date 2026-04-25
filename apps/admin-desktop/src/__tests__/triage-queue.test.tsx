import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockUseMuniReports = vi.fn()

vi.mock('../hooks/useMuniReports', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useMuniReports: (...args: unknown[]) => mockUseMuniReports(...args),
}))

vi.mock('../app/firebase', () => ({
  db: {},
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: { municipalityId: 'daet', role: 'municipal_admin' },
    signOut: vi.fn(),
  }),
}))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: vi.fn(),
    rejectReport: vi.fn(),
  },
}))

vi.mock('../pages/ReportDetailPanel', () => ({
  ReportDetailPanel: () => <div>detail</div>,
}))
vi.mock('../pages/DispatchModal', () => ({
  DispatchModal: () => <div>dispatch</div>,
}))
vi.mock('../pages/CloseReportModal', () => ({
  CloseReportModal: () => <div>close</div>,
}))

import { TriageQueuePage } from '../pages/TriageQueuePage'

describe('TriageQueuePage', () => {
  beforeEach(() => {
    mockUseMuniReports.mockReturnValue({
      reports: [],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
  })

  it('renders Load More button when hasMore is true', () => {
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: true,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('does not render Load More button when hasMore is false', () => {
    render(<TriageQueuePage />)
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('calls loadMore when Load More is clicked', () => {
    const loadMore = vi.fn()
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: true,
      loadMore,
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('shows Showing X count', () => {
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
        {
          reportId: 'r2',
          status: 'new',
          severity: 'medium',
          createdAt: null,
          municipalityLabel: '',
        },
      ],
      hasMore: true,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    expect(screen.getByText(/showing 2/i)).toBeInTheDocument()
  })

  it('renders severity from severity field, not severityDerived', () => {
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    expect(screen.getByText(/high/i)).toBeInTheDocument()
  })
})
