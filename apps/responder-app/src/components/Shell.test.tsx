import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useAuthMock = vi.hoisted(() => vi.fn())
const useOwnDispatchesMock = vi.hoisted(() => vi.fn())

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: useAuthMock,
}))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: useOwnDispatchesMock,
}))

vi.mock('./SosHoldButton', () => ({
  SosHoldButton: ({ disabled }: { disabled: boolean }) => (
    <button data-testid="sos-btn" disabled={disabled}>
      SOS
    </button>
  ),
}))

import { Shell } from './Shell'

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: { uid: 'uid-1' } })
  useOwnDispatchesMock.mockReturnValue({
    groups: { active: [], pending: [{ dispatchId: 'pending-1' }, { dispatchId: 'pending-2' }] },
    rows: [],
    error: null,
  })
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: true,
  })
})

describe('Shell', () => {
  it('renders the warm header contract', () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    )

    expect(screen.getByText('BANTAYOG ALERT')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Online')
    expect(screen.getByTestId('sos-btn')).toBeInTheDocument()
    expect(screen.getByTestId('sos-btn')).toBeDisabled()
  })

  it('renders the five bottom tabs in operational order and keeps the pending badge', () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'Dispatches',
      'Map',
      'Feed',
      'Alerts',
      'Profile',
    ])
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/2 pending/i)).toBeInTheDocument()
  })
})
