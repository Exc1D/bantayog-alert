import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgencyDispatchModal } from './AgencyDispatchModal.js'

const { mockUseAgencyResponders, mockCallable, mockHttpsCallable } = vi.hoisted(() => ({
  mockUseAgencyResponders: vi.fn(),
  mockCallable: vi.fn(),
  mockHttpsCallable: vi.fn(() => mockCallable),
}))

vi.mock('../hooks/useAgencyResponders', () => ({
  useAgencyResponders: (...args: unknown[]) => mockUseAgencyResponders(...args),
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

vi.mock('../utils/freshness', () => ({
  computeFreshness: vi.fn(() => 'fresh'),
}))

const onDutyResponder = {
  uid: 'resp1',
  displayName: 'Maria Santos',
  agencyId: 'bfp',
  availabilityStatus: 'available',
  lastTelemetryAt: Date.now() - 3000,
}

const mockClose = vi.fn()
const mockError = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockCallable.mockResolvedValue({
    data: { dispatchId: 'd1', status: 'dispatched', reportId: 'r1' },
  })
  mockUseAgencyResponders.mockReturnValue([onDutyResponder])
})

describe('AgencyDispatchModal', () => {
  it('shows only on-duty responders from the agency', () => {
    render(<AgencyDispatchModal reportId="r1" onClose={mockClose} onError={mockError} />)
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
  })

  it('shows empty message when no on-duty responders are available', () => {
    mockUseAgencyResponders.mockReturnValue([])
    render(<AgencyDispatchModal reportId="r1" onClose={mockClose} onError={mockError} />)
    expect(screen.getByText(/no on-duty responders available/i)).toBeInTheDocument()
  })

  it('calls dispatchResponder with agencyId when confirmed', async () => {
    render(<AgencyDispatchModal reportId="r1" onClose={mockClose} onError={mockError} />)
    fireEvent.click(screen.getByRole('radio', { name: /Maria Santos/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'dispatchResponder')
      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r1',
          responderUid: 'resp1',
        }),
      )
    })
  })

  it('Confirm button is disabled until a responder is selected', () => {
    render(<AgencyDispatchModal reportId="r1" onClose={mockClose} onError={mockError} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /Maria Santos/i }))
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<AgencyDispatchModal reportId="r1" onClose={mockClose} onError={mockError} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockClose).toHaveBeenCalledTimes(1)
  })
})
