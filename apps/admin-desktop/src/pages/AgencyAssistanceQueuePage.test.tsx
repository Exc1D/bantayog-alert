import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgencyAssistanceQueuePage } from './AgencyAssistanceQueuePage.js'

const { mockOnSnapshot, mockCallable, mockHttpsCallable } = vi.hoisted(() => {
  return {
    mockOnSnapshot: vi.fn(),
    mockCallable: vi.fn(),
    mockHttpsCallable: vi.fn(() => mockCallable),
  }
})

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: mockOnSnapshot,
  getFirestore: vi.fn(),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
  getFunctions: vi.fn(),
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: vi.fn(() => ({
    claims: { role: 'agency_admin', agencyId: 'bfp' },
    loading: false,
  })),
}))

vi.mock('../app/firebase', () => ({
  db: {},
  auth: {},
  functions: {},
}))

const pendingRequest = {
  id: 'ar1',
  data: () => ({
    reportId: 'r1',
    requestedByMunicipality: 'Daet',
    message: 'Need BFP assistance',
    priority: 'urgent',
    status: 'pending',
    targetAgencyId: 'bfp',
    createdAt: 1713350400000,
  }),
}

beforeEach(() => {
  mockOnSnapshot.mockImplementation((_q, cb) => {
    cb({ docs: [pendingRequest] })
    return vi.fn() // unsubscribe
  })
  mockCallable.mockResolvedValue({ data: { status: 'accepted' } })
})

describe('AgencyAssistanceQueuePage', () => {
  it('renders pending requests for agency_admin role', () => {
    render(<AgencyAssistanceQueuePage />)
    expect(screen.getByText('Need BFP assistance')).toBeInTheDocument()
  })

  it('shows Accept and Decline buttons on pending requests', () => {
    render(<AgencyAssistanceQueuePage />)
    // Use getAllByRole and pick the ones with exact text (action buttons)
    const acceptButtons = screen.getAllByRole('button', { name: /^Accept$/ })
    const declineButtons = screen.getAllByRole('button', { name: /^Decline$/ })
    expect(acceptButtons).toHaveLength(1)
    expect(declineButtons).toHaveLength(1)
  })

  it('calls acceptAgencyAssistance callable on Accept click', async () => {
    render(<AgencyAssistanceQueuePage />)
    const acceptButton = screen.getByRole('button', { name: /^Accept$/ })
    fireEvent.click(acceptButton)
    await waitFor(() => {
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'acceptAgencyAssistance')
      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'ar1',
        }),
      )
    })
  })

  it('requires reason before allowing decline submit', async () => {
    render(<AgencyAssistanceQueuePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Decline$/ }))
    const submitBtn = await screen.findByRole('button', { name: /submit decline/i })
    expect(submitBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'Too far' } })
    expect(submitBtn).not.toBeDisabled()
  })

  it('calls declineAgencyAssistance callable with requestId and reason', async () => {
    render(<AgencyAssistanceQueuePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Decline$/ }))
    const submitBtn = await screen.findByRole('button', { name: /submit decline/i })
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'Too far' } })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'declineAgencyAssistance')
      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'ar1',
          reason: 'Too far',
        }),
      )
    })
  })
})
