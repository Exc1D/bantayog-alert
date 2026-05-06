import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
const messagesState = vi.hoisted(() => ({
  groups: {
    active: [] as { dispatchId: string; reportId: string; uiStatus: string }[],
    pending: [] as { dispatchId: string; reportId: string; uiStatus: string }[],
  },
  error: null as string | null,
}))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({
    groups: messagesState.groups,
    rows: [],
    error: messagesState.error,
  }),
}))

import { MessagesPage } from './MessagesPage'

describe('MessagesPage', () => {
  beforeEach(() => {
    messagesState.groups = { active: [], pending: [] }
    messagesState.error = null
  })

  it('shows empty state when no active dispatches', () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no active dispatches/i)).toBeInTheDocument()
  })

  it('renders thread cards when active dispatches exist', () => {
    messagesState.groups = {
      active: [{ dispatchId: 'd-1', reportId: 'r-1', uiStatus: 'on_scene' }],
      pending: [],
    }
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Incident #r-1/)).toBeInTheDocument()
    expect(screen.getByText(/On Scene/)).toBeInTheDocument()
  })
})
