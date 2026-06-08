import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TriagePage from './TriagePage'

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

  it('renders only triage-eligible reports', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Triage workbench' })).toBeInTheDocument()
    expect(screen.getByText('Water is rising near the creek')).toBeInTheDocument()
    expect(screen.getByText('Smoke in a residential block')).toBeInTheDocument()
    expect(screen.getByText('Responder needed for an elderly resident')).toBeInTheDocument()
    expect(screen.queryByText('Already resolved')).not.toBeInTheDocument()
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
})
