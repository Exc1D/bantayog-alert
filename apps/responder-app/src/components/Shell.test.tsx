import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useAuthMock = vi.hoisted(() => vi.fn())
const useOwnDispatchesMock = vi.hoisted(() => vi.fn())
const useOnlineStatusMock = vi.hoisted(() => vi.fn())

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: useAuthMock,
}))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: useOwnDispatchesMock,
}))

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: useOnlineStatusMock,
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
  useOnlineStatusMock.mockReturnValue(true)
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

    expect(
      screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-label'))
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['Dispatches', 'Map', 'Feed', 'Alerts', 'Profile'])
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/2 pending/i)).toBeInTheDocument()
  })

  it('shows Offline status when useOnlineStatus returns false', () => {
    useOnlineStatusMock.mockReturnValue(false)

    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Offline')
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Offline')
  })

  it('renders a skip link to main content', () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    )

    const skip = screen.getByRole('link', { name: /skip to main content/i })
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })
})
