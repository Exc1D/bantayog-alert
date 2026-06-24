import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TriagePage, { buildTriageExportCsv } from './TriagePage'

const mockNavigate = vi.fn()
const mockVerifyReport = vi.hoisted(() =>
  vi.fn(({ reportId }: { reportId: string }) =>
    Promise.resolve({
      reportId,
      status: reportId === 'r-new' ? 'awaiting_verify' : 'verified',
    }),
  ),
)
const mockRejectReport = vi.hoisted(() =>
  vi.fn(({ reportId }: { reportId: string }) =>
    Promise.resolve({
      reportId,
      status: 'rejected',
    }),
  ),
)

const exportReport = {
  id: 'r-export',
  type: 'flood' as const,
  severity: 'high' as const,
  status: 'awaiting_verify' as const,
  municipality: 'Daet',
  barangay: 'Bagasbas',
  description: 'Water, rising near "creek"',
  reporterName: '',
  reporterPhone: '',
  latitude: 14.1,
  longitude: 122.9,
  createdAt: '2026-06-08T08:00:00.000Z',
  updatedAt: '2026-06-08T08:00:00.000Z',
}

const mockReportDocs = vi.hoisted(() => [
  {
    id: 'r-new',
    reportType: 'flood',
    severity: 'medium',
    municipalityLabel: 'Daet',
    barangayId: 'Bagasbas',
    submittedAt: 1,
    updatedAt: 1,
    description: 'Water is rising near the creek',
    status: 'new',
  },
  {
    id: 'r-awaiting',
    reportType: 'fire',
    severity: 'high',
    municipalityLabel: 'Daet',
    barangayId: 'Centro',
    submittedAt: 1,
    updatedAt: 1,
    description: 'Smoke in a residential block',
    status: 'awaiting_verify',
  },
  {
    id: 'r-verified',
    reportType: 'medical',
    severity: 'low',
    municipalityLabel: 'Daet',
    barangayId: 'Poblacion',
    submittedAt: 1,
    updatedAt: 1,
    description: 'Responder needed for an elderly resident',
    status: 'verified',
  },
  {
    id: 'r-closed',
    reportType: 'flood',
    severity: 'low',
    municipalityLabel: 'Daet',
    barangayId: 'Magang',
    submittedAt: 1,
    updatedAt: 1,
    description: 'Already resolved',
    status: 'closed',
  },
])
const mockListenerState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
}))

vi.mock('../app/firebase', () => ({
  db: {} as never,
  getFirestoreInstance: () => ({}) as never,
  auth: {} as never,
  functions: {} as never,
  rtdb: {} as never,
  firebaseApp: {} as never,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: { role: 'municipal_admin', municipalityId: 'daet' },
    loading: false,
    signOut: vi.fn(),
  }),
}))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    rejectReport: mockRejectReport,
  },
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: mockListenerState.loading,
    error: mockListenerState.error,
    get reports() {
      // Return a fresh copy so content mutations are visible to useMemo deps
      return [...mockReportDocs]
    },
    reportOps: [],
    alerts: [],
    responders: [],
    situationUpdates: [],
  }),
}))

function renderPage() {
  return render(<TriagePage />, { wrapper: MemoryRouter })
}

describe('TriagePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockVerifyReport.mockClear()
    mockRejectReport.mockClear()

    // Reset mutable mock report docs between tests
    mockReportDocs[0]!.description = 'Water is rising near the creek'
    mockReportDocs[0]!.submittedAt = 1
    mockReportDocs[0]!.status = 'new'
    mockReportDocs[1]!.description = 'Smoke in a residential block'
    mockReportDocs[1]!.submittedAt = 1
    mockReportDocs[1]!.status = 'awaiting_verify'
    mockReportDocs[2]!.description = 'Responder needed for an elderly resident'
    mockReportDocs[2]!.submittedAt = 1
    mockReportDocs[2]!.status = 'verified'
    mockReportDocs[3]!.description = 'Already resolved'
    mockReportDocs[3]!.submittedAt = 1
    mockReportDocs[3]!.status = 'closed'
    mockListenerState.loading = false
    mockListenerState.error = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders only triage-eligible reports', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Triage workbench' })).toBeInTheDocument()
    expect(screen.getByText('Water is rising near the creek')).toBeInTheDocument()
    expect(screen.getByText('Smoke in a residential block')).toBeInTheDocument()
    expect(screen.getByText('Responder needed for an elderly resident')).toBeInTheDocument()
    expect(screen.queryByText('Already resolved')).not.toBeInTheDocument()
  })

  it('filters triage reports by status, severity, type, and search text', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Status filter'), {
      target: { value: 'awaiting_verify' },
    })
    expect(screen.getByText('Smoke in a residential block')).toBeInTheDocument()
    expect(screen.queryByText('Water is rising near the creek')).not.toBeInTheDocument()
    expect(screen.queryByText('Responder needed for an elderly resident')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Severity filter'), {
      target: { value: 'high' },
    })
    fireEvent.change(screen.getByLabelText('Type filter'), {
      target: { value: 'fire' },
    })
    fireEvent.change(screen.getByLabelText('Search triage reports'), {
      target: { value: 'smoke' },
    })
    expect(screen.getByText('Smoke in a residential block')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search triage reports'), {
      target: { value: 'creek' },
    })
    expect(screen.queryByText('Smoke in a residential block')).not.toBeInTheDocument()
    expect(screen.getByLabelText('All reports triaged')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Water is rising near the creek')).toBeInTheDocument()
    expect(screen.getByText('Smoke in a residential block')).toBeInTheDocument()
    expect(screen.getByText('Responder needed for an elderly resident')).toBeInTheDocument()
  })

  it('advances new reports and verifies awaiting reports through command callables', async () => {
    renderPage()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-new')).getByRole('button', { name: 'Verify' }),
    )
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-new',
          idempotencyKey: expect.any(String),
        }),
      )
    })
    expect(await screen.findByText('Report sent to review')).toBeInTheDocument()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-awaiting')).getByRole('button', { name: 'Verify' }),
    )
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-awaiting',
          idempotencyKey: expect.any(String),
        }),
      )
    })
    expect(await screen.findByText('Report verified')).toBeInTheDocument()
  })

  it('retries a failed verify command with the original idempotency key', async () => {
    mockVerifyReport
      .mockRejectedValueOnce(new Error('Network split'))
      .mockResolvedValueOnce({ reportId: 'r-new', status: 'awaiting_verify' })
    renderPage()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-new')).getByRole('button', { name: 'Verify' }),
    )

    await screen.findByText('Network split')
    const firstPayload = mockVerifyReport.mock.calls[0]?.[0]
    expect(firstPayload).toEqual(
      expect.objectContaining({
        reportId: 'r-new',
        idempotencyKey: expect.any(String),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry command' }))

    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledTimes(2)
    })
    expect(mockVerifyReport).toHaveBeenCalledTimes(2)
    expect(mockVerifyReport.mock.calls[1]?.[0]).toEqual(firstPayload)
    expect(await screen.findByText('Report sent to review')).toBeInTheDocument()
  })

  it('clears stale retry commands before failed bulk verify', async () => {
    mockVerifyReport
      .mockRejectedValueOnce(new Error('Single network split'))
      .mockRejectedValueOnce(new Error('Bulk verify failed'))
    renderPage()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-new')).getByRole('button', { name: 'Verify' }),
    )
    await screen.findByText('Single network split')
    expect(screen.getByRole('button', { name: 'Retry command' })).toBeEnabled()

    fireEvent.click(screen.getByLabelText('Select report r-awaiting'))
    fireEvent.click(screen.getByRole('button', { name: 'Verify Selected' }))

    await screen.findByText('Bulk verify completed with 1 error(s): Bulk verify failed')
    expect(screen.queryByRole('button', { name: 'Retry command' })).not.toBeInTheDocument()
    expect(mockVerifyReport.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ reportId: 'r-awaiting' }),
    )
  })

  it('clears stale retry commands before failed bulk reject', async () => {
    mockVerifyReport.mockRejectedValueOnce(new Error('Single network split'))
    mockRejectReport.mockRejectedValueOnce(new Error('Bulk reject failed'))
    mockReportDocs[2]!.status = 'awaiting_verify'
    renderPage()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-new')).getByRole('button', { name: 'Verify' }),
    )
    await screen.findByText('Single network split')
    expect(screen.getByRole('button', { name: 'Retry command' })).toBeEnabled()

    fireEvent.click(screen.getByLabelText('Select report r-awaiting'))
    fireEvent.click(screen.getByLabelText('Select report r-verified'))
    fireEvent.click(screen.getByRole('button', { name: 'Reject Selected' }))

    const dialog = await screen.findByRole('dialog', { name: 'Reject selected reports?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject 2 reports' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Bulk reject completed with 1 error(s)')
      expect(screen.getByRole('alert')).toHaveTextContent('Bulk reject failed')
    })
    expect(screen.queryByRole('button', { name: 'Retry command' })).not.toBeInTheDocument()
    expect(mockRejectReport).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 'r-awaiting' }),
    )
    expect(mockRejectReport).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 'r-verified' }),
    )
  })

  it('does not offer retry for non-retryable command errors', async () => {
    mockVerifyReport.mockRejectedValueOnce(new Error('permission-denied'))
    renderPage()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-new')).getByRole('button', { name: 'Verify' }),
    )

    await screen.findByText('permission-denied')

    expect(screen.queryByRole('button', { name: 'Retry command' })).not.toBeInTheDocument()
  })

  it('routes verified reports to the map for responder dispatch', () => {
    renderPage()

    fireEvent.click(screen.getByTestId('report-row-r-verified'))
    expect(mockNavigate).toHaveBeenCalledWith('/map?reportId=r-verified')
  })

  it('confirms the selected rejection reason before single rejection', async () => {
    renderPage()

    expect(screen.queryByLabelText('Rejection reason')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Admin note')).not.toBeInTheDocument()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-awaiting')).getByRole('button', { name: 'Reject' }),
    )

    expect(mockRejectReport).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Reject report?' })
    fireEvent.change(within(dialog).getByLabelText('Rejection reason'), {
      target: { value: 'duplicate' },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject report' }))

    await waitFor(() => {
      expect(mockRejectReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-awaiting',
          reason: 'duplicate',
          idempotencyKey: expect.any(String),
        }),
      )
    })
    expect(await screen.findByText('Report rejected')).toBeInTheDocument()
  })

  it('shows and sends the admin note after rejection confirmation', async () => {
    renderPage()

    fireEvent.click(
      within(screen.getByTestId('report-row-r-awaiting')).getByRole('button', { name: 'Reject' }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Reject report?' })
    fireEvent.change(within(dialog).getByLabelText('Admin note'), {
      target: { value: '  Duplicate citizen upload from the same street  ' },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject report' }))

    await waitFor(() => {
      expect(mockRejectReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-awaiting',
          notes: 'Duplicate citizen upload from the same street',
          idempotencyKey: expect.any(String),
        }),
      )
    })
  })

  it('confirms bulk rejection with count, reason, and note before committing', async () => {
    renderPage()

    fireEvent.click(screen.getByLabelText('Select report r-awaiting'))
    fireEvent.click(screen.getByRole('button', { name: 'Reject Selected' }))

    expect(mockRejectReport).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Reject selected reports?' })
    fireEvent.change(within(dialog).getByLabelText('Rejection reason'), {
      target: { value: 'test_submission' },
    })
    fireEvent.change(within(dialog).getByLabelText('Admin note'), {
      target: { value: '  Training drill report  ' },
    })
    expect(within(dialog).getByText('1 report')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject 1 report' }))

    await waitFor(() => {
      expect(mockRejectReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-awaiting',
          reason: 'test_submission',
          notes: 'Training drill report',
          idempotencyKey: expect.any(String),
        }),
      )
    })
  })

  it.each(['unauthorized', 'permission-denied', 'permission_denied', 'denied'])(
    'shows a permission-denied state for %s listener errors',
    (errorToken) => {
      mockListenerState.error = errorToken

      renderPage()

      expect(
        screen.getByRole('heading', { name: "You don't have access to this data" }),
      ).toBeInTheDocument()
      expect(screen.getByText(/your role or area assignment may have changed/i)).toBeInTheDocument()
      expect(screen.queryByText(errorToken)).not.toBeInTheDocument()
    },
  )

  it('builds a CSV export for visible triage rows without private reporter fields', () => {
    const csv = buildTriageExportCsv([exportReport])

    expect(csv).toContain(
      'reportId,type,severity,status,municipality,barangay,description,createdAt',
    )
    expect(csv).toContain('"Water, rising near ""creek"""')
    expect(csv).not.toContain('reporterPhone')
    expect(csv).not.toContain('reporterName')
  })

  it('neutralizes spreadsheet formulas in CSV export cells', () => {
    const csv = buildTriageExportCsv([
      {
        ...exportReport,
        description: '=HYPERLINK("https://evil.example","click")',
      },
    ])

    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""click"")"`)
  })

  it('warns when triage data has not refreshed recently', () => {
    vi.useFakeTimers()
    renderPage()

    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000)
    })

    expect(screen.getByRole('status')).toHaveTextContent(/triage data may be stale/i)
    expect(screen.getByRole('status')).toHaveTextContent(/6m ago/i)
  })

  it('does not mark triage data stale after same-length report content refresh', () => {
    vi.useFakeTimers()
    const { rerender } = renderPage()

    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000)
    })

    mockReportDocs[0]!.description = 'Water is rising near the updated creek'
    mockReportDocs[0]!.updatedAt = 2

    rerender(<TriagePage />)

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
