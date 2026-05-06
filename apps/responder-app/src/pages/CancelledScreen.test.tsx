import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DispatchDoc } from '../hooks/useDispatch'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

import { CancelledScreen } from './CancelledScreen'

function makeDispatchDoc(
  partial: Partial<DispatchDoc> & { dispatchId: string; reportId: string },
): DispatchDoc {
  return {
    assignedTo: { uid: 'u1', agencyId: 'a1', municipalityId: 'm1' },
    dispatchedBy: 'admin-1',
    dispatchedByRole: 'municipal_admin',
    dispatchedAt: Date.now(),
    statusUpdatedAt: Date.now(),
    status: 'cancelled',
    uiStatus: 'terminal',
    terminalSurface: 'cancelled',
    ...partial,
  } as unknown as DispatchDoc
}

describe('CancelledScreen', () => {
  it('renders the cancellation reason when provided', () => {
    render(
      <MemoryRouter>
        <CancelledScreen
          dispatch={makeDispatchDoc({
            dispatchId: 'd-1',
            reportId: 'r-1',
            cancelReason: 'False alarm',
          })}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Dispatch Cancelled/i)
    expect(screen.getByText(/False alarm/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dispatches/i })).toBeInTheDocument()
  })

  it('renders fallback text when no reason is given', () => {
    render(
      <MemoryRouter>
        <CancelledScreen
          dispatch={makeDispatchDoc({
            dispatchId: 'd-1',
            reportId: 'r-1',
          })}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/cancelled by the admin/)).toBeInTheDocument()
  })
})
