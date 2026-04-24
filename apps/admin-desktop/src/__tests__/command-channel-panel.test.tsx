import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CommandChannelPanel } from '../components/CommandChannelPanel.js'
import { httpsCallable } from 'firebase/functions'

const { mockOnSnapshot, mockHttpsCallable, mockGetFunctions, mockDb } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockHttpsCallable: vi.fn(),
  mockGetFunctions: vi.fn(() => ({})),
  mockDb: {},
}))

interface MockQueryRef {
  type: string
  filters: { type: string; field?: string }[]
}

vi.mock('firebase/firestore', () => {
  const collection = vi.fn((_db, name) => ({ type: 'collection', name }))
  const where = vi.fn((field, _op, value) => ({ type: 'where', field, value }))
  const orderBy = vi.fn((field, dir) => ({ type: 'orderBy', field, dir }))
  const limit = vi.fn((n) => ({ type: 'limit', n }))
  const query = vi.fn((...args) => ({ type: 'query', filters: args.slice(1) }))
  return {
    getFirestore: vi.fn(() => mockDb),
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot: mockOnSnapshot,
    doc: vi.fn(),
  }
})

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockHttpsCallable),
  getFunctions: mockGetFunctions,
}))

const threadSnap = {
  docs: [
    {
      id: 'th1',
      data: () => ({
        threadType: 'agency_assistance',
        subject: 'Test thread',
        participantUids: { u1: true, u2: true },
        lastMessageAt: 1000,
      }),
    },
  ],
  empty: false,
}

const msgSnap = {
  docs: [
    {
      id: 'm1',
      data: () => ({
        authorUid: 'u2',
        body: 'Hello world',
        createdAt: 1000,
      }),
    },
  ],
  empty: false,
}

beforeEach(() => {
  mockOnSnapshot.mockReset()
  mockHttpsCallable.mockReset()
  mockHttpsCallable.mockResolvedValue({ data: { status: 'sent' } })

  mockOnSnapshot.mockImplementation((ref: MockQueryRef, cb) => {
    if (ref.type === 'query') {
      const isMessages = ref.filters.some((f) => f.type === 'where' && f.field === 'threadId')
      cb(isMessages ? msgSnap : threadSnap)
    }
    return vi.fn()
  })
})

describe('CommandChannelPanel', () => {
  it('renders nothing when no threads', () => {
    mockOnSnapshot.mockImplementation((ref: MockQueryRef, cb) => {
      if (ref.type === 'query') {
        cb({ docs: [], empty: true })
      }
      return vi.fn()
    })
    const { container } = render(<CommandChannelPanel reportId="r1" currentUserUid="u1" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders thread tabs and messages', () => {
    render(<CommandChannelPanel reportId="r1" currentUserUid="u1" />)
    expect(screen.getByText('🏥 Agency')).toBeInTheDocument()
    expect(screen.getByText('Test thread')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('sends a message when clicking Send', async () => {
    render(<CommandChannelPanel reportId="r1" currentUserUid="u1" />)
    const textarea = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(textarea, { target: { value: 'Units dispatched' } })
    fireEvent.click(screen.getByText('Send'))
    await waitFor(() => {
      expect(httpsCallable).toHaveBeenCalledWith(expect.any(Object), 'addCommandChannelMessage')
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'th1',
          body: 'Units dispatched',
          idempotencyKey: expect.any(String),
        }),
      )
    })
    expect(textarea).toHaveValue('')
  })

  it('displays an error when send fails', async () => {
    mockHttpsCallable.mockRejectedValue(new Error('Network error'))
    render(<CommandChannelPanel reportId="r1" currentUserUid="u1" />)
    const textarea = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(textarea, { target: { value: 'Fail me' } })
    fireEvent.click(screen.getByText('Send'))
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('enforces max length of 2000', () => {
    render(<CommandChannelPanel reportId="r1" currentUserUid="u1" />)
    const textarea = screen.getByPlaceholderText('Type a message...')
    expect(textarea).toHaveAttribute('maxLength', '2000')
  })
})
