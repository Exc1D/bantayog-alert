import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockAdvance = vi.fn(() => new Promise(() => undefined))

vi.mock('../hooks/useDispatch', () => ({
  useDispatch: () => ({
    dispatch: {
      dispatchId: 'd-1',
      reportId: 'report-1',
      status: 'accepted',
      uiStatus: 'accepted',
      terminalSurface: null,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useReport', () => ({
  useReport: () => ({
    report: {
      reportType: 'flood',
      severity: 'medium',
      status: 'verified',
      description: 'Heavy water in the streets',
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayId: 'Barangay 5',
      publicLocation: { latitude: 14.1, longitude: 122.9 },
      source: 'web',
      submittedAt: 1700000000000,
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useAcceptDispatch', () => ({
  useAcceptDispatch: () => ({ accept: vi.fn(), loading: false, error: undefined }),
}))

vi.mock('../hooks/useAdvanceDispatch', () => ({
  useAdvanceDispatch: () => ({ advance: mockAdvance, loading: false, error: undefined }),
}))

vi.mock('../hooks/useDeclineDispatch', () => ({
  useDeclineDispatch: () => ({ decline: vi.fn(), loading: false, error: undefined }),
}))

vi.mock('../hooks/useMarkDispatchUnableToComplete', () => ({
  useMarkDispatchUnableToComplete: () => ({
    markUnableToComplete: vi.fn(),
    loading: false,
    error: undefined,
  }),
}))

vi.mock('../hooks/useAddFieldNote', () => ({
  useAddFieldNote: () => ({ addNote: vi.fn(), loading: false, error: undefined }),
}))

import { DispatchDetailPage } from './DispatchDetailPage'

describe('DispatchDetailPage', () => {
  it('shows an "Acknowledging" status indicator while auto-advance from accepted is in-flight', () => {
    render(
      <MemoryRouter initialEntries={['/dispatches/d-1']}>
        <Routes>
          <Route path="/dispatches/:dispatchId" element={<DispatchDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(mockAdvance).toHaveBeenCalledWith('acknowledged')
    expect(screen.getByRole('status')).toHaveTextContent(/acknowledg/i)
  })
})
