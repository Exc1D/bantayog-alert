import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgencyAssistanceQueuePage } from './AgencyAssistanceQueuePage.js'

const { mockUseAgencyAssistanceQueue, mockCallable, mockHttpsCallable } = vi.hoisted(() => {
  return {
    mockUseAgencyAssistanceQueue: vi.fn(),
    mockCallable: vi.fn(),
    mockHttpsCallable: vi.fn(() => mockCallable),
  }
})

vi.mock('../hooks/useAgencyAssistanceQueue', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useAgencyAssistanceQueue: (...args: unknown[]) => mockUseAgencyAssistanceQueue(...args),
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
  reportId: 'r1',
  requestedByMunicipality: 'Daet',
  message: 'Need BFP assistance',
  priority: 'urgent' as const,
  status: 'pending' as const,
  targetAgencyId: 'bfp',
  createdAt: 1713350400000,
}

beforeEach(() => {
  mockUseAgencyAssistanceQueue.mockReturnValue({
    requests: [pendingRequest],
    backupRequests: [],
    loading: false,
    error: null,
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
