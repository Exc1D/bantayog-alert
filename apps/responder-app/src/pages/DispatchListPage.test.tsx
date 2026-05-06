import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({
    rows: [
      {
        dispatchId: 'd-1',
        reportId: 'report-1',
        status: 'pending',
        uiStatus: 'pending',
        acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
      },
    ],
    groups: {
      pending: [
        {
          dispatchId: 'd-1',
          reportId: 'report-1',
          status: 'pending',
          uiStatus: 'pending',
          acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
        },
      ],
      active: [],
    },
    error: null,
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
  it('shows incident type label and severity in pending dispatch card', () => {
    render(
      <MemoryRouter>
        <DispatchListPage />
      </MemoryRouter>,
    )

    // The reportTypeLabel("flood") output is "🌊 Flood"; the severity value is "high".
    expect(screen.getByText(/Flood/)).toBeInTheDocument()
    expect(screen.getByText(/high/i)).toBeInTheDocument()
    expect(screen.getByText(/Daet/)).toBeInTheDocument()
  })
})
