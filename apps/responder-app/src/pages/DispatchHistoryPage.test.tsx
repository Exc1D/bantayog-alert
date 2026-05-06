import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const historyState = vi.hoisted(() => ({
  history: [] as {
    dispatchId: string
    reportId: string
    status: string
    dispatchedAt: number
  }[],
  loading: false,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
}))

vi.mock('../hooks/useDispatchHistory', () => ({
  useDispatchHistory: () => ({
    history: historyState.history,
    loading: historyState.loading,
    error: null,
  }),
}))

import { DispatchHistoryPage } from './DispatchHistoryPage'

describe('DispatchHistoryPage', () => {
  beforeEach(() => {
    historyState.history = []
    historyState.loading = false
  })

  it('renders rows for completed dispatches', () => {
    historyState.history = [
      {
        dispatchId: 'd-1',
        reportId: 'report-abc',
        status: 'resolved',
        dispatchedAt: 1700000000000,
      },
      {
        dispatchId: 'd-2',
        reportId: 'report-def',
        status: 'declined',
        dispatchedAt: 1700003600000,
      },
    ]

    render(
      <MemoryRouter>
        <DispatchHistoryPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/✅ Resolved/)).toBeInTheDocument()
    expect(screen.getByText(/✗ Declined/)).toBeInTheDocument()
    expect(screen.getByText(/report-a/)).toBeInTheDocument()
  })

  it('shows empty state when no history', () => {
    render(
      <MemoryRouter>
        <DispatchHistoryPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/No completed dispatches yet/)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    historyState.loading = true

    render(
      <MemoryRouter>
        <DispatchHistoryPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Loading/)).toBeInTheDocument()
  })
})
