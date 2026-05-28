import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import type { QueueDispatchRow } from '../lib/dispatch-presentation'

vi.mock('../hooks/useReport', () => ({
  useReport: () => ({
    report: { reportType: 'flood', severity: 'high' },
    loading: false,
  }),
}))

import { DispatchRow } from './DispatchRow'

function renderRow(props: QueueDispatchRow) {
  render(
    <MemoryRouter>
      <DispatchRow row={props} now={Date.now()} />
    </MemoryRouter>,
  )
}

describe('DispatchRow', () => {
  it('renders pending dispatch as compact row', () => {
    renderRow({
      dispatchId: 'd-1',
      reportId: 'r-1',
      status: 'pending',
      dispatchedAt: Date.now(),
      acknowledgementDeadlineAt: { toMillis: () => Date.now() + 5 * 60 * 1000 },
      uiStatus: 'pending',
    } as unknown as QueueDispatchRow)

    expect(screen.getByText(/Flood/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /accept/i })).toBeInTheDocument()
  })
})
