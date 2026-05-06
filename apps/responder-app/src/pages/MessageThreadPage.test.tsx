import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))

const mockSend = vi.fn()
vi.mock('../hooks/useSendMessage', () => ({
  useSendMessage: () => ({ send: mockSend, loading: false }),
}))

vi.mock('../hooks/useMessages', () => ({
  useMessages: () => ({
    messages: [
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
    ],
    loading: false,
    error: null,
  }),
}))

import { MessageThreadPage } from './MessageThreadPage'

describe('MessageThreadPage', () => {
  it('classifies bubbles by authorUid match against current user', () => {
    render(
      <MemoryRouter initialEntries={['/messages/report-1']}>
        <Routes>
          <Route path="/messages/:reportId" element={<MessageThreadPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const mine = screen.getByText('Sent by me').closest('div')
    const theirs = screen.getByText('Sent by admin').closest('div')

    expect(mine?.className).toMatch(/bubbleMine/)
    expect(theirs?.className).toMatch(/bubbleTheirs/)
  })
})
