import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
}))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))

vi.mock('./SosHoldButton', () => ({
  SosHoldButton: ({ disabled }: { disabled: boolean }) => (
    <button data-testid="sos-btn" disabled={disabled}>
      SOS
    </button>
  ),
}))

import { Shell } from './Shell'

describe('Shell', () => {
  it('renders tab navigation with 4 tabs', () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /dispatches/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /map/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /messages/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
  })

  it('renders SOS button in header', () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('sos-btn')).toBeInTheDocument()
  })
})
