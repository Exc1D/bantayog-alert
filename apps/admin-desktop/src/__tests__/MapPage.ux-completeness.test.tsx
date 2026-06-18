import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import MapPage from '../pages/MapPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import {
  createMapFirestoreListeners,
  renderSelectedMapReport,
  renderWithMemoryRouter,
} from '../test-utils'

vi.mock('../app/firebase', async () =>
  (await import('../test-utils')).createAdminFirebaseModuleMock(),
)

const mockVerifyReport = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockRejectReport = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockDispatchResponder = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockDeclareAlert = vi.hoisted(() => vi.fn().mockResolvedValue({ alertId: 'a1' }))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    rejectReport: mockRejectReport,
    dispatchResponder: mockDispatchResponder,
    declareAlert: mockDeclareAlert,
  },
}))

const mockUseFirestoreListeners = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    loading: false,
    error: null,
    reports: [],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
)

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: mockUseFirestoreListeners,
}))

vi.mock('../providers/WindowSyncProvider', async () =>
  (await import('../test-utils')).createWindowSyncProviderModuleMock(),
)

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('MapPage UX completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFirestoreListeners.mockReturnValue(createMapFirestoreListeners([], []))
    useCommandCenterStore.setState({
      selectedMunicipalityId: null,
      selectedReportId: null,
      triageFilters: {},
      chartTimeRange: '7d',
      statusBarExpanded: false,
      statusBarExpandedOverride: null,
      mapBounds: null,
      activeOverlays: new Set(['all_incidents']),
      triagePanelOpen: false,
      lastSyncMessage: null,
      suppressNextBroadcast: false,
    })
  })

  it('renders header and map', () => {
    renderWithMemoryRouter(<MapPage />)
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
  })

  it('shows empty state when no reports exist', () => {
    renderWithMemoryRouter(<MapPage />)
    expect(screen.getByText('No active incidents')).toBeInTheDocument()
  })

  it('opens alert declaration from the map header', () => {
    renderWithMemoryRouter(<MapPage />)
    fireEvent.click(screen.getByRole('button', { name: /declare alert/i }))
    expect(screen.getByRole('dialog', { name: /declare alert/i })).toBeInTheDocument()
  })

  it('shows success banner after verifying a report', async () => {
    renderSelectedMapReport(<MapPage />, mockUseFirestoreListeners, {
      id: 'r-awaiting',
      type: 'flood',
      severity: 'high',
      municipality: 'Daet',
      barangay: 'Camambugan',
      createdAt: '14:02',
      status: 'awaiting_verify',
      description: 'Needs verification',
      latitude: 14.1,
      longitude: 122.9,
      updatedAt: '',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    // Confirm in the Verify confirmation modal — the second Verify button is the modal confirm
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' })
    expect(verifyButtons.length).toBe(2)
    const confirmVerify = verifyButtons[1]
    expect(confirmVerify).toBeDefined()
    fireEvent.click(confirmVerify!)
    await flushPromises()

    // SuccessBanner is the only status role inside the absolute-positioned container
    expect(screen.getByText('Report verified')).toBeInTheDocument()
  })

  it('shows success banner after rejecting a report', async () => {
    renderSelectedMapReport(<MapPage />, mockUseFirestoreListeners, {
      id: 'r-awaiting',
      type: 'flood',
      severity: 'high',
      municipality: 'Daet',
      barangay: 'Camambugan',
      createdAt: '14:02',
      status: 'awaiting_verify',
      description: 'Needs verification',
      latitude: 14.1,
      longitude: 122.9,
      updatedAt: '',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    // Confirm in modal — the modal confirm button is the second Reject
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    expect(rejectButtons.length).toBe(2)
    const confirmReject = rejectButtons[1]
    expect(confirmReject).toBeDefined()
    fireEvent.click(confirmReject!)
    await flushPromises()

    expect(screen.getByText('Report rejected')).toBeInTheDocument()
  })

  it('blocks rejection notes over 500 characters before calling rejectReport', async () => {
    renderSelectedMapReport(<MapPage />, mockUseFirestoreListeners, {
      id: 'r-awaiting',
      type: 'flood',
      severity: 'high',
      municipality: 'Daet',
      barangay: 'Camambugan',
      createdAt: '14:02',
      status: 'awaiting_verify',
      description: 'Needs verification',
      latitude: 14.1,
      longitude: 122.9,
      updatedAt: '',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.change(screen.getByLabelText('Admin note (optional)'), {
      target: { value: 'x'.repeat(501) },
    })
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    fireEvent.click(rejectButtons[1]!)
    await flushPromises()

    expect(mockRejectReport).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Admin note must be 500 characters or fewer',
    )
  })

  it('renders keyboard-navigable incident list when reports exist', () => {
    mockUseFirestoreListeners.mockReturnValue(
      createMapFirestoreListeners([
        {
          id: 'r1',
          type: 'flood',
          severity: 'high',
          municipality: 'Daet',
          barangay: 'Camambugan',
          createdAt: '14:02',
          status: 'new',
          description: 'Water rising',
          latitude: 14.1,
          longitude: 122.9,
          updatedAt: '',
        },
      ]),
    )

    renderWithMemoryRouter(<MapPage />)

    const list = screen.getByLabelText(/keyboard-navigable incident list/i)
    expect(list).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /flood incident, severity high, at Daet, Camambugan/i }),
    ).toBeInTheDocument()
  })

  it('selects report via keyboard list button', () => {
    mockUseFirestoreListeners.mockReturnValue(
      createMapFirestoreListeners([
        {
          id: 'r1',
          type: 'flood',
          severity: 'high',
          municipality: 'Daet',
          barangay: 'Camambugan',
          createdAt: '14:02',
          status: 'new',
          description: 'Water rising',
          latitude: 14.1,
          longitude: 122.9,
          updatedAt: '',
        },
      ]),
    )

    renderWithMemoryRouter(<MapPage />)

    fireEvent.click(
      screen.getByRole('button', { name: /flood incident, severity high, at Daet, Camambugan/i }),
    )

    // Selecting via keyboard list should open the TriagePanel (dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
