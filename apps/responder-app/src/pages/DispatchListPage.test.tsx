import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.hoisted(() => vi.fn())

const dispatchListState = vi.hoisted(() => ({
  rows: [] as {
    dispatchId: string
    reportId: string
    status: string
    uiStatus: string
    acknowledgementDeadlineAt: { toMillis: () => number }
  }[],
  groups: {
    pending: [] as {
      dispatchId: string
      reportId: string
      status: string
      uiStatus: string
      acknowledgementDeadlineAt: { toMillis: () => number }
    }[],
    active: [] as {
      dispatchId: string
      reportId: string
      status: string
      uiStatus: string
      acknowledgementDeadlineAt: { toMillis: () => number }
    }[],
  },
  error: null as string | null,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({
    rows: dispatchListState.rows,
    groups: dispatchListState.groups,
    error: dispatchListState.error,
  }),
}))

vi.mock('../hooks/useReport', () => ({
  useReport: () => ({
    report: {
      reportType: 'flood',
      severity: 'high',
      status: 'verified',
      description: '',
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayId: 'Barangay 5',
      source: 'web',
      submittedAt: 1700000000000,
    },
    loading: false,
    error: null,
  }),
}))

import { DispatchListPage } from './DispatchListPage'

describe('DispatchListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    dispatchListState.rows = []
    dispatchListState.groups = { pending: [], active: [] }
    dispatchListState.error = null
  })

  it('shows incident type label and severity in pending dispatch card', () => {
    dispatchListState.rows = [
      {
        dispatchId: 'd-1',
        reportId: 'report-1',
        status: 'pending',
        uiStatus: 'pending',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
    ]
    dispatchListState.groups.pending = [
      {
        dispatchId: 'd-1',
        reportId: 'report-1',
        status: 'pending',
        uiStatus: 'pending',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
    ]

    render(
      <MemoryRouter>
        <DispatchListPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Flood/)).toBeInTheDocument()
    expect(screen.getByText(/high/i)).toBeInTheDocument()
    expect(screen.getByText(/Daet/)).toBeInTheDocument()
  })

  it('shows both pending and active sections when both exist', () => {
    dispatchListState.rows = [
      {
        dispatchId: 'd-1',
        reportId: 'report-1',
        status: 'pending',
        uiStatus: 'pending',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
      {
        dispatchId: 'd-2',
        reportId: 'report-2',
        status: 'acknowledged',
        uiStatus: 'acknowledged',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
    ]
    dispatchListState.groups.pending = [
      {
        dispatchId: 'd-1',
        reportId: 'report-1',
        status: 'pending',
        uiStatus: 'pending',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
    ]
    dispatchListState.groups.active = [
      {
        dispatchId: 'd-2',
        reportId: 'report-2',
        status: 'acknowledged',
        uiStatus: 'acknowledged',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
    ]

    render(
      <MemoryRouter>
        <DispatchListPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/New Dispatches/i)).toBeInTheDocument()
    expect(screen.getByText(/Active/i)).toBeInTheDocument()
  })

  it('renders empty state with All Clear copy when no dispatches', () => {
    render(
      <MemoryRouter>
        <DispatchListPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/All Clear/i)).toBeInTheDocument()
    expect(screen.getByText(/No active dispatches/i)).toBeInTheDocument()
  })

  it('shows error banner on listener error', () => {
    dispatchListState.error = 'permission-denied'

    render(
      <MemoryRouter>
        <DispatchListPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/permission-denied/)
  })
})
