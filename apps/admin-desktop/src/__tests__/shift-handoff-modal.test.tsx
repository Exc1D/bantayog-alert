import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockInitiateHandoff = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))

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
    initiateShiftHandoff: mockInitiateHandoff,
    acceptShiftHandoff: vi.fn(),
  },
}))

vi.mock('../hooks/useMuniReports', () => ({
  useMuniReports: () => ({
    reports: [],
    hasMore: false,
    loadMore: vi.fn(),
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/usePendingHandoffs', () => ({
  usePendingHandoffs: () => ({ handoffs: [], error: null }),
}))

vi.mock('../pages/ReportDetailPanel', () => ({ ReportDetailPanel: () => <div>detail</div> }))
vi.mock('../pages/DispatchModal', () => ({ DispatchModal: () => <div>dispatch</div> }))
vi.mock('../pages/CloseReportModal', () => ({ CloseReportModal: () => <div>close</div> }))

import { TriageQueuePage } from '../pages/TriageQueuePage'

describe('ShiftHandoffModal', () => {
  beforeEach(() => {
    mockInitiateHandoff.mockResolvedValue({ success: true, handoffId: 'h-new-1' })
  })

  it('renders Start Handoff button in header', () => {
    render(<TriageQueuePage />)
    expect(screen.getByRole('button', { name: /start handoff/i })).toBeInTheDocument()
  })

  it('opens ShiftHandoffModal on Start Handoff click', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /start handoff/i }))
    expect(screen.getByRole('dialog', { name: /shift handoff/i })).toBeInTheDocument()
  })

  it('calls initiateShiftHandoff on Initiate click', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /start handoff/i }))
    const notesField = screen.getByLabelText(/notes/i)
    await user.type(notesField, 'End of day shift')
    await user.click(screen.getByRole('button', { name: /initiate/i }))
    expect(mockInitiateHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'End of day shift' }),
    )
  })
})

describe('Incoming handoff banner', () => {
  it('shows no banner when no pending handoffs', () => {
    render(<TriageQueuePage />)
    expect(screen.queryByRole('button', { name: /accept handoff/i })).not.toBeInTheDocument()
  })
})
