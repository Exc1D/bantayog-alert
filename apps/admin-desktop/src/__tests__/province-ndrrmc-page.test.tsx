import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockOnSnapshot, mockForward } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockForward: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: mockOnSnapshot,
  updateDoc: vi.fn(),
  doc: vi.fn(),
}))

vi.mock('../app/firebase', () => ({ db: {} }))

vi.mock('../services/callables', () => ({
  callables: {
    forwardMassAlertToNDRRMC: mockForward,
  },
}))

// react-router-dom useNavigate mock
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => mockNavigate,
  }
})

import { ProvinceNdrrmcPage } from '../pages/ProvinceNdrrmcPage'

const PENDING_ITEM = {
  id: 'esc-001',
  status: 'pending_review',
  message: 'Severe flooding in Daet requires national support',
  affectedMunicipalities: ['daet', 'labo'],
  createdAt: { toMillis: () => Date.now() - 3600000 },
}

const FORWARDED_ITEM = {
  id: 'esc-002',
  status: 'forwarded',
  message: 'Landslide alert in Capalonga',
  affectedMunicipalities: ['capalonga'],
  createdAt: { toMillis: () => Date.now() - 7200000 },
  forwardedAt: { toMillis: () => Date.now() - 3600000 },
}

function makeSnapshotDocs(items: (typeof PENDING_ITEM)[]) {
  return {
    docs: items.map((item) => ({
      id: item.id,
      data: () => item,
    })),
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProvinceNdrrmcPage />
    </MemoryRouter>,
  )
}

describe('ProvinceNdrrmcPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no items
    mockOnSnapshot.mockImplementation((_q: unknown, callback: (snap: unknown) => void) => {
      callback(makeSnapshotDocs([]))
      return vi.fn() // unsubscribe
    })
    mockForward.mockResolvedValue({ success: true })
  })

  it('renders empty state when no pending escalations', async () => {
    renderPage()
    expect(await screen.findByText(/no pending ndrrmc escalations/i)).toBeInTheDocument()
  })

  it('renders pending escalation rows from Firestore', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, callback: (snap: unknown) => void) => {
      callback(makeSnapshotDocs([PENDING_ITEM]))
      return vi.fn()
    })
    renderPage()
    expect(await screen.findByText(/severe flooding in daet/i)).toBeInTheDocument()
  })

  it('opens inline review panel when a row is clicked', async () => {
    const user = userEvent.setup()
    mockOnSnapshot.mockImplementation((_q: unknown, callback: (snap: unknown) => void) => {
      callback(makeSnapshotDocs([PENDING_ITEM]))
      return vi.fn()
    })
    renderPage()
    const row = await screen.findByText(/severe flooding in daet/i)
    await user.click(row)
    // Review panel shows full message and forward button
    expect(await screen.findByRole('button', { name: /forward to ndrrmc/i })).toBeInTheDocument()
  })

  it('calls forwardMassAlertToNDRRMC when Forward button is clicked', async () => {
    const user = userEvent.setup()
    mockOnSnapshot.mockImplementation((_q: unknown, callback: (snap: unknown) => void) => {
      callback(makeSnapshotDocs([PENDING_ITEM]))
      return vi.fn()
    })
    renderPage()
    await user.click(await screen.findByText(/severe flooding in daet/i))
    const forwardBtn = await screen.findByRole('button', { name: /forward to ndrrmc/i })
    await user.click(forwardBtn)
    await waitFor(() => {
      expect(mockForward).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'esc-001' }))
    })
  })

  it('shows forwarded items in a separate section after forwarding', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, callback: (snap: unknown) => void) => {
      callback(makeSnapshotDocs([FORWARDED_ITEM]))
      return vi.fn()
    })
    renderPage()
    expect(await screen.findByText(/forwarded/i)).toBeInTheDocument()
  })

  it('pressing N key navigates to /province/ndrrmc', () => {
    renderPage()
    // Simulate pressing N
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
    expect(mockNavigate).toHaveBeenCalledWith('/province/ndrrmc')
  })

  it('N key does not navigate when focus is in an input', () => {
    render(
      <MemoryRouter>
        <input data-testid="test-input" />
        <ProvinceNdrrmcPage />
      </MemoryRouter>,
    )
    const input = screen.getByTestId('test-input')
    input.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
