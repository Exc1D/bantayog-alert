import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({
    rows: [],
    groups: { active: [], pending: [] },
    error: null,
  }),
}))

import { MessagesPage } from './MessagesPage'

describe('MessagesPage', () => {
  it('shows empty state when no active dispatches', () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no active dispatches/i)).toBeInTheDocument()
  })
})
