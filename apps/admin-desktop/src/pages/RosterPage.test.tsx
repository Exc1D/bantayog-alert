import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RosterPage } from './RosterPage.js'

const { mockUseRosterManagement, mockCallable, mockHttpsCallable } = vi.hoisted(() => ({
  mockUseRosterManagement: vi.fn(),
  mockCallable: vi.fn(),
  mockHttpsCallable: vi.fn(() => mockCallable),
}))

vi.mock('../hooks/useRosterManagement', () => ({
  useRosterManagement: (...args: unknown[]) => mockUseRosterManagement(...args),
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

const mockSuspendResponder = vi.fn()
const mockRevokeResponder = vi.fn()
const mockBulkAvailabilityOverride = vi.fn()

const sampleResponder = {
  uid: 'r1',
  displayName: 'Juan dela Cruz',
  availabilityStatus: 'available',
  lastTelemetryAt: Date.now() - 5000,
  municipalityId: 'daet',
  responderType: 'FIR' as const,
  specializations: ['Hazmat Certified', 'Swift Water'],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCallable.mockResolvedValue({ data: { uid: 'r1', status: 'revoked' } })
  mockSuspendResponder.mockResolvedValue(undefined)
  mockRevokeResponder.mockResolvedValue(undefined)
  mockBulkAvailabilityOverride.mockResolvedValue(undefined)
  mockUseRosterManagement.mockReturnValue({
    responders: [sampleResponder],
    loading: false,
    error: null,
    suspendResponder: mockSuspendResponder,
    revokeResponder: mockRevokeResponder,
    bulkAvailabilityOverride: mockBulkAvailabilityOverride,
  })
})

describe('RosterPage', () => {
  it('renders responder display name', () => {
    render(<RosterPage />)
    expect(screen.getByText('Juan dela Cruz')).toBeInTheDocument()
  })

  it('renders responder type badge', () => {
    render(<RosterPage />)
    expect(screen.getByText('FIR')).toBeInTheDocument()
  })

  it('renders specialization chips for each specialization', () => {
    render(<RosterPage />)
    expect(screen.getByText('Hazmat Certified')).toBeInTheDocument()
    expect(screen.getByText('Swift Water')).toBeInTheDocument()
  })

  it('shows Set All On-Duty and Set All Off-Duty bulk buttons in header', () => {
    render(<RosterPage />)
    expect(screen.getByRole('button', { name: /set all on.duty/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set all off.duty/i })).toBeInTheDocument()
  })

  it('calls bulkAvailabilityOverride with available after confirming Set All On-Duty', async () => {
    render(<RosterPage />)
    fireEvent.click(screen.getByRole('button', { name: /set all on.duty/i }))
    // Confirmation prompt should appear
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockBulkAvailabilityOverride).toHaveBeenCalledWith(
        expect.arrayContaining(['r1']),
        'available',
      )
    })
  })

  it('calls bulkAvailabilityOverride with off_duty after confirming Set All Off-Duty', async () => {
    render(<RosterPage />)
    fireEvent.click(screen.getByRole('button', { name: /set all off.duty/i }))
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockBulkAvailabilityOverride).toHaveBeenCalledWith(
        expect.arrayContaining(['r1']),
        'off_duty',
      )
    })
  })

  it('shows revoke reason input before calling revokeResponder', async () => {
    render(<RosterPage />)
    fireEvent.click(screen.getByRole('button', { name: /revoke access/i }))
    expect(await screen.findByPlaceholderText(/reason for revoke/i)).toBeInTheDocument()
  })

  it('calls revokeResponder only after reason is entered and confirmed', async () => {
    render(<RosterPage />)
    fireEvent.click(screen.getByRole('button', { name: /revoke access/i }))
    const reasonInput = await screen.findByPlaceholderText(/reason for revoke/i)
    const confirmRevoke = screen.getByRole('button', { name: /confirm revoke/i })
    expect(confirmRevoke).toBeDisabled()
    fireEvent.change(reasonInput, { target: { value: 'Lost device' } })
    expect(confirmRevoke).not.toBeDisabled()
    fireEvent.click(confirmRevoke)
    await waitFor(() => {
      expect(mockRevokeResponder).toHaveBeenCalledWith('r1')
    })
  })

  it('renders empty state when no responders exist', () => {
    mockUseRosterManagement.mockReturnValue({
      responders: [],
      loading: false,
      error: null,
      suspendResponder: mockSuspendResponder,
      revokeResponder: mockRevokeResponder,
      bulkAvailabilityOverride: mockBulkAvailabilityOverride,
    })
    render(<RosterPage />)
    expect(screen.getByText(/no responders/i)).toBeInTheDocument()
  })
})
