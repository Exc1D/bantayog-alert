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
    loading: false,
    error: null,
    reports: [
      {
        id: 'r-new',
        reportType: 'flood',
        severity: 'medium',
        municipalityLabel: 'Daet',
        barangayId: 'Bagasbas',
        submittedAt: Date.now(),
        description: 'Water is rising near the creek',
        status: 'new',
      },
      {
        id: 'r-awaiting',
        reportType: 'fire',
        severity: 'high',
        municipalityLabel: 'Daet',
        barangayId: 'Centro',
        submittedAt: Date.now(),
        description: 'Smoke in a residential block',
        status: 'awaiting_verify',
      },
      {
        id: 'r-verified',
        reportType: 'medical',
        severity: 'low',
        municipalityLabel: 'Daet',
        barangayId: 'Poblacion',
        submittedAt: Date.now(),
        description: 'Responder needed for an elderly resident',
        status: 'verified',
      },
      {
        id: 'r-closed',
        reportType: 'flood',
        severity: 'low',
        municipalityLabel: 'Daet',
        barangayId: 'Magang',
        submittedAt: Date.now(),
        description: 'Already resolved',
        status: 'closed',
      },
    ],
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

  it('routes verified reports to the map for responder dispatch', () => {
    renderPage()

    fireEvent.click(screen.getByTestId('report-row-r-verified'))
    expect(mockNavigate).toHaveBeenCalledWith('/map?reportId=r-verified')
  })

  it('uses the selected rejection reason for triage rejection', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Rejection reason'), {
      target: { value: 'duplicate' },
    })
    fireEvent.click(
      within(screen.getByTestId('report-row-r-awaiting')).getByRole('button', { name: 'Reject' }),
    )

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

  it('sends the admin note with triage rejection', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Admin note'), {
      target: { value: '  Duplicate citizen upload from the same street  ' },
    })
    fireEvent.click(
      within(screen.getByTestId('report-row-r-awaiting')).getByRole('button', { name: 'Reject' }),
    )

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

  it('builds a CSV export for visible triage rows without private reporter fields', () => {
    const csv = buildTriageExportCsv([exportReport])

    expect(csv).toContain('reportId,type,severity,status,municipality,barangay,description,createdAt')
    expect(csv).toContain('"Water, rising near ""creek"""')
    expect(csv).not.toContain('reporterPhone')
    expect(csv).not.toContain('reporterName')
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
})
