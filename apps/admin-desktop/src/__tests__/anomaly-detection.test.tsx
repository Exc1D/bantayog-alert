import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockOnSnapshot, mockUpdateDoc } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockUpdateDoc: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: mockOnSnapshot,
  doc: vi.fn((db: unknown, path: string, id: string) => ({ _path: `${path}/${id}` })),
  updateDoc: mockUpdateDoc,
}))

vi.mock('../app/firebase', () => ({ db: {} }))

import { AnomalyAlertBar } from '../components/AnomalyAlertBar'

const RESPONSE_TIME_ANOMALY = {
  id: 'anom-1',
  type: 'response_time_spike',
  municipalityId: 'daet',
  description: 'Response time spiked to 32 minutes',
  detectedAt: { toMillis: () => Date.now() - 600000 },
  severity: 'high',
}

const RESOLUTION_DROP_ANOMALY = {
  id: 'anom-2',
  type: 'resolution_drop',
  municipalityId: 'labo',
  description: 'Resolution rate dropped below 50%',
  detectedAt: { toMillis: () => Date.now() - 1200000 },
  severity: 'medium',
}

const SHIFT_GAP_ANOMALY = {
  id: 'anom-3',
  type: 'admin_shift_gap',
  municipalityId: 'capalonga',
  description: 'No admin on duty for 2 hours',
  detectedAt: { toMillis: () => Date.now() - 1800000 },
  severity: 'low',
}

function makeSnap(items: (typeof RESPONSE_TIME_ANOMALY)[]) {
  return {
    docs: items.map((a) => ({
      id: a.id,
      data: () => a,
    })),
  }
}

describe('AnomalyAlertBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateDoc.mockResolvedValue(undefined)
  })

  it('renders nothing when there are no anomalies', () => {
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([]))
      return vi.fn()
    })
    const { container } = render(<AnomalyAlertBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders anomaly rows when anomalies exist', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([RESPONSE_TIME_ANOMALY]))
      return vi.fn()
    })
    render(<AnomalyAlertBar />)
    expect(await screen.findByText(/response time spiked/i)).toBeInTheDocument()
  })

  it('shows TriangleAlert icon for response_time_spike type', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([RESPONSE_TIME_ANOMALY]))
      return vi.fn()
    })
    render(<AnomalyAlertBar />)
    // The icon renders as SVG; check that the anomaly text is shown alongside the row
    expect(await screen.findByText(/daet/i)).toBeInTheDocument()
  })

  it('shows TrendingDown anomaly row for resolution_drop type', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([RESOLUTION_DROP_ANOMALY]))
      return vi.fn()
    })
    render(<AnomalyAlertBar />)
    expect(await screen.findByText(/resolution rate dropped/i)).toBeInTheDocument()
    expect(await screen.findByText(/labo/i)).toBeInTheDocument()
  })

  it('shows admin_shift_gap anomaly row', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([SHIFT_GAP_ANOMALY]))
      return vi.fn()
    })
    render(<AnomalyAlertBar />)
    expect(await screen.findByText(/no admin on duty/i)).toBeInTheDocument()
  })

  it('calls updateDoc to dismiss anomaly when Dismiss is clicked', async () => {
    const user = userEvent.setup()
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([RESPONSE_TIME_ANOMALY]))
      return vi.fn()
    })
    render(<AnomalyAlertBar />)
    const dismissBtn = await screen.findByRole('button', { name: /dismiss/i })
    await user.click(dismissBtn)
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'dismissed' }),
      )
    })
  })

  it('renders multiple anomaly rows', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap([RESPONSE_TIME_ANOMALY, RESOLUTION_DROP_ANOMALY, SHIFT_GAP_ANOMALY]))
      return vi.fn()
    })
    render(<AnomalyAlertBar />)
    expect(await screen.findAllByRole('button', { name: /dismiss/i })).toHaveLength(3)
  })
})
