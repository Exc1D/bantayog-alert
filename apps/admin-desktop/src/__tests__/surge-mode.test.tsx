import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const { mockVerifyReport, mockRejectReport } = vi.hoisted(() => ({
  mockVerifyReport: vi.fn(),
  mockRejectReport: vi.fn(),
}))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    rejectReport: mockRejectReport,
    requestAgencyAssistance: vi.fn(),
    dispatchResponder: vi.fn(),
    closeReport: vi.fn(),
    acceptShiftHandoff: vi.fn(),
    initiateShiftHandoff: vi.fn(),
  },
}))

vi.mock('../app/firebase', () => ({ db: {} }))

const mockUseMuniReports = vi.fn()
vi.mock('../hooks/useMuniReports', () => ({
  useMuniReports: (...args: unknown[]) => mockUseMuniReports(...args),
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: { municipalityId: 'daet', role: 'municipal_admin' },
    signOut: vi.fn(),
  }),
}))

vi.mock('../hooks/usePendingHandoffs', () => ({
  usePendingHandoffs: () => ({ handoffs: [], error: null }),
}))

vi.mock('../pages/TriagePanel', () => ({
  TriagePanel: ({ reportId }: { reportId: string }) => (
    <div data-testid={`triage-panel-${reportId}`}>Panel for {reportId}</div>
  ),
}))

vi.mock('../pages/DispatchModal', () => ({
  DispatchModal: () => <div>dispatch</div>,
}))
vi.mock('../pages/CloseReportModal', () => ({
  CloseReportModal: () => <div>close</div>,
}))
vi.mock('../pages/MassAlertModal', () => ({
  MassAlertModal: () => <div>mass alert</div>,
}))

import { TriageQueuePage } from '../pages/TriageQueuePage'

const TWO_UNVERIFIED = [
  {
    reportId: 'r1',
    status: 'awaiting_verify',
    severity: 'high',
    reportType: 'flood',
    createdAt: null,
    municipalityLabel: 'Daet',
  },
  {
    reportId: 'r2',
    status: 'awaiting_verify',
    severity: 'medium',
    reportType: 'fire',
    createdAt: null,
    municipalityLabel: 'Daet',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyReport.mockResolvedValue({ status: 'verified', reportId: 'r1' })
  mockRejectReport.mockResolvedValue({ status: 'rejected', reportId: 'r1' })
  mockUseMuniReports.mockReturnValue({
    reports: TWO_UNVERIFIED,
    hasMore: false,
    loadMore: vi.fn(),
    loading: false,
    error: null,
  })
})

describe('Surge Mode', () => {
  it('renders Surge Mode toggle button in triage header', () => {
    render(<TriageQueuePage />)
    expect(screen.getByRole('button', { name: /surge mode/i })).toBeInTheDocument()
  })

  it('activates surge mode when Surge Mode button is clicked', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    expect(screen.getByText(/surge mode active/i)).toBeInTheDocument()
  })

  it('shows unverified report count in surge banner', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    // Should show count of awaiting_verify reports
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('toggles off surge mode with Escape key', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    expect(screen.getByText(/surge mode active/i)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText(/surge mode active/i)).not.toBeInTheDocument()
  })

  it('pressing S key toggles surge mode when no modal is open', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.keyboard('s')
    expect(screen.getByText(/surge mode active/i)).toBeInTheDocument()
  })

  it('surge mode shows dense list of awaiting_verify reports', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    expect(screen.getByLabelText(/surge queue/i)).toBeInTheDocument()
    const items = screen.getAllByRole('option')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('V key calls verifyReport for highlighted report in surge mode', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    // First item is highlighted by default (index 0)
    await user.keyboard('v')
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r1' }))
    })
  })

  it('arrow down moves highlight to next report in surge mode', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    await user.keyboard('{ArrowDown}')
    // After ArrowDown, second item should be highlighted
    // Press V to verify the now-highlighted second item
    await user.keyboard('v')
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r2' }))
    })
  })

  it('S key skips to next report in surge mode', async () => {
    // When surge mode is already on, pressing S should skip (not toggle)
    // We need to test this differently — pressing S again should skip
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    // S key inside surge mode = skip (move to next)
    await user.keyboard('s')
    // After skip, V should verify second report
    await user.keyboard('v')
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r2' }))
    })
  })

  it('has aria-live="polite" region for keyboard action announcements', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /surge mode/i }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
