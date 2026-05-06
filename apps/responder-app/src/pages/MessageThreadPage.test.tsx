import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const messagesState = vi.hoisted(() => ({
  messages: [] as {
    id: string
    body: string
    authorUid: string
    authorRole: string
    authorDisplayName: string
    createdAt: number
  }[],
  loading: false,
  error: null as string | null,
}))

const sendState = vi.hoisted(() => ({
  loading: false,
  error: undefined as Error | undefined,
}))

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))

vi.mock('../hooks/useSendMessage', () => ({
  useSendMessage: () => ({
    send: vi.fn(),
    loading: sendState.loading,
    error: sendState.error,
  }),
}))

vi.mock('../hooks/useMessages', () => ({
  useMessages: () => ({
    messages: messagesState.messages,
    loading: messagesState.loading,
    error: messagesState.error,
  }),
}))

import { MessageThreadPage } from './MessageThreadPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/messages/report-1']}>
      <Routes>
        <Route path="/messages/:reportId" element={<MessageThreadPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MessageThreadPage', () => {
  beforeEach(() => {
    messagesState.messages = []
    messagesState.loading = false
    messagesState.error = null
    sendState.loading = false
    sendState.error = undefined
  })

  it('classifies bubbles by authorUid match against current user', () => {
    messagesState.messages = [
      {
        id: 'msg-mine',
        body: 'Sent by me',
        authorUid: 'uid-1',
        authorRole: 'responder',
        authorDisplayName: 'BFP Responder 01',
        createdAt: 1700000000000,
      },
      {
        id: 'msg-theirs',
        body: 'Sent by admin',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin',
        authorDisplayName: 'Admin Santos',
        createdAt: 1700000010000,
      },
    ]
    renderPage()
    const mine = screen.getByText('Sent by me').closest('div')
    const theirs = screen.getByText('Sent by admin').closest('div')
    expect(mine?.className).toMatch(/bubbleMine/)
    expect(theirs?.className).toMatch(/bubbleTheirs/)
  })

  it('shows an empty-state hint when no messages and not loading', () => {
    renderPage()
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument()
  })

  it('shows an alert pill when useMessages reports an error', () => {
    messagesState.error = 'permission-denied'
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/permission-denied/)
  })

  it('shows an alert pill when useSendMessage reports an error', () => {
    sendState.error = new Error('send failed')
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/send failed/)
  })
})
