import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  send: vi.fn(),
  loading: false,
  error: undefined as Error | undefined,
}))

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))

vi.mock('../hooks/useSendMessage', () => ({
  useSendMessage: () => sendState,
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
    sendState.send.mockClear()
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

  it('sends message via Enter key in the textarea', async () => {
    sendState.send.mockResolvedValueOnce(undefined)
    renderPage()

    const user = userEvent.setup()
    const textarea = screen.getByLabelText(/message input/i)
    await user.type(textarea, 'Hello admin')
    await user.keyboard('{Enter}')

    expect(sendState.send).toHaveBeenCalledTimes(1)
    expect(sendState.send).toHaveBeenCalledWith('Hello admin')
  })

  it('restores draft when send fails', async () => {
    sendState.send.mockRejectedValueOnce(new Error('network error'))
    renderPage()

    const user = userEvent.setup()
    const textarea = screen.getByLabelText<HTMLTextAreaElement>(/message input/i)
    await user.type(textarea, 'Urgent update')
    await user.keyboard('{Enter}')

    expect(sendState.send).toHaveBeenCalledTimes(1)
    expect(textarea.value).toBe('Urgent update')
  })

  it('auto-scrolls only when user is near the bottom of the list', () => {
    const scrollIntoViewSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)

    messagesState.messages = [
      {
        id: 'msg-1',
        body: 'First',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin',
        authorDisplayName: 'Admin',
        createdAt: 1700000000000,
      },
    ]
    const { rerender } = renderPage()

    const list = screen.getByRole('log')
    // The initial mount may have fired scrollIntoView depending on happy-dom
    // defaults; clear the spy so we only assert on subsequent updates.
    scrollIntoViewSpy.mockClear()

    // Simulate user scrolled far up (distance = 1000 - 100 - 300 = 600 > 80)
    Object.defineProperty(list, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(list, 'scrollTop', { value: 100, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 300, configurable: true })

    // Add another message while user is scrolled up — should NOT auto-scroll
    messagesState.messages = [
      ...messagesState.messages,
      {
        id: 'msg-2',
        body: 'Second',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin',
        authorDisplayName: 'Admin',
        createdAt: 1700000010000,
      },
    ]
    rerender(
      <MemoryRouter initialEntries={['/messages/report-1']}>
        <Routes>
          <Route path="/messages/:reportId" element={<MessageThreadPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(scrollIntoViewSpy).not.toHaveBeenCalled()

    // Move near bottom (distance = 1000 - 630 - 300 = 70 < 80)
    Object.defineProperty(list, 'scrollTop', { value: 630, configurable: true })

    messagesState.messages = [
      ...messagesState.messages,
      {
        id: 'msg-3',
        body: 'Third',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin',
        authorDisplayName: 'Admin',
        createdAt: 1700000020000,
      },
    ]
    rerender(
      <MemoryRouter initialEntries={['/messages/report-1']}>
        <Routes>
          <Route path="/messages/:reportId" element={<MessageThreadPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1)

    scrollIntoViewSpy.mockRestore()
  })
})
