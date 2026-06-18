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
const mockDispatchResponder = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ dispatchId: 'd1', status: 'ASSIGNED', reportId: 'r1' }),
)

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    rejectReport: vi.fn().mockResolvedValue({}),
    dispatchResponder: mockDispatchResponder,
  },
}))

vi.mock('../providers/WindowSyncProvider', async () =>
  (await import('../test-utils')).createWindowSyncProviderModuleMock(),
)

const mockUseFirestoreListeners = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r1',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'new',
        description: 'Water rising',
        reporterName: 'Juan',
        reporterPhone: '0917xxx',
        latitude: 14.1,
        longitude: 122.9,
        updatedAt: '',
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [['uid1', { displayName: 'Responder A', agency: 'BFP' }]],
  }),
)

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: mockUseFirestoreListeners,
}))

function renderSelectedReport(report: Record<string, unknown>) {
  renderSelectedMapReport(<MapPage />, mockUseFirestoreListeners, report)
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

async function submitDispatchAttempt() {
  if (!screen.queryByLabelText('Select Agency')) {
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
  }
  fireEvent.change(screen.getByLabelText('Select Agency'), { target: { value: 'BFP' } })
  fireEvent.change(screen.getByLabelText('Select Responder'), { target: { value: 'uid1' } })
  fireEvent.mouseDown(screen.getByRole('button', { name: /hold to dispatch/i }))
  act(() => {
    vi.advanceTimersByTime(1100)
  })
  fireEvent.mouseUp(screen.getByRole('button', { name: /hold to dispatch/i }))
  await flushPromises()
}

describe('MapPage Firestore wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
          reporterName: 'Juan',
          reporterPhone: '0917xxx',
          latitude: 14.1,
          longitude: 122.9,
          updatedAt: '',
        },
      ]),
    )
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
    })
  })

  it('throws when renderSelectedMapReport receives a report without an id', () => {
    expect(() =>
      renderSelectedMapReport(<MapPage />, mockUseFirestoreListeners, {
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'new',
        description: 'Water rising',
        reporterName: 'Juan',
        reporterPhone: '0917xxx',
        latitude: 14.1,
        longitude: 122.9,
        updatedAt: '',
      }),
    ).toThrow('renderSelectedMapReport requires a non-empty report.id')
  })

  it('renders map with reports from Firestore', () => {
    renderWithMemoryRouter(<MapPage />)
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    // Confirm useFirestoreListeners is invoked and wired to the page
    expect(mockUseFirestoreListeners).toHaveBeenCalledWith(
      expect.objectContaining({ windowType: 'map' }),
    )
  })

  it('shows TriagePanel when report selected', () => {
    useCommandCenterStore.setState({ selectedReportId: 'r1' })
    renderWithMemoryRouter(<MapPage />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not show reject or dispatch controls for a newly submitted report', () => {
    useCommandCenterStore.setState({ selectedReportId: 'r1' })
    renderWithMemoryRouter(<MapPage />)

    expect(screen.getByRole('dialog')).toHaveTextContent('Water rising')
    expect(screen.getByRole('button', { name: 'Advance to review' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dispatch Responder' })).not.toBeInTheDocument()
  })

  it.each(['assigned', 'acknowledged'] as const)(
    'does not show or trigger dispatch for %s reports',
    async (status) => {
      vi.useFakeTimers()
      try {
        renderSelectedReport({
          id: `r-${status}`,
          type: 'fire',
          severity: 'high',
          municipality: 'Daet',
          barangay: 'Camambugan',
          createdAt: '14:02',
          status,
          description: 'Already dispatched',
          latitude: 14.1,
          longitude: 122.9,
          updatedAt: '',
        })

        const dispatchButton = screen.queryByRole('button', { name: 'Dispatch Responder' })
        if (dispatchButton) await submitDispatchAttempt()

        expect(dispatchButton).not.toBeInTheDocument()
        expect(mockDispatchResponder).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    },
  )

  it('surfaces dispatch rejection messages and clears stale errors before retrying', async () => {
    vi.useFakeTimers()
    try {
      mockDispatchResponder.mockRejectedValueOnce(new Error('Responder is off shift'))
      renderSelectedReport({
        id: 'r-verified',
        type: 'fire',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'verified',
        description: 'Smoke reported',
        latitude: 14.1,
        longitude: 122.9,
        updatedAt: '',
      })

      await submitDispatchAttempt()

      expect(screen.getByRole('alert')).toHaveTextContent('Responder is off shift')

      let resolveDispatch: ((value: unknown) => void) | undefined
      mockDispatchResponder.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDispatch = resolve
          }),
      )

      await submitDispatchAttempt()

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await act(async () => {
        resolveDispatch?.({})
        await Promise.resolve()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('dispatches only the selected verified report to the selected responder', async () => {
    vi.useFakeTimers()
    try {
      mockUseFirestoreListeners.mockReturnValue(
        createMapFirestoreListeners([
          {
            id: 'r-verified',
            type: 'fire',
            severity: 'high',
            municipality: 'Daet',
            barangay: 'Camambugan',
            createdAt: '14:02',
            status: 'verified',
            description: 'Smoke reported',
            latitude: 14.1,
            longitude: 122.9,
            updatedAt: '',
          },
          {
            id: 'r-other',
            type: 'flood',
            severity: 'medium',
            municipality: 'Labo',
            barangay: 'San Roque',
            createdAt: '14:08',
            status: 'verified',
            description: 'Water rising',
            latitude: 14.2,
            longitude: 122.8,
            updatedAt: '',
          },
        ]),
      )
      useCommandCenterStore.setState({ selectedReportId: 'r-verified' })
      renderWithMemoryRouter(<MapPage />)

      await submitDispatchAttempt()

      expect(mockDispatchResponder).toHaveBeenCalledTimes(1)
      expect(mockDispatchResponder).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-verified',
          responderUid: 'uid1',
        }),
      )
      expect(mockDispatchResponder).not.toHaveBeenCalledWith(
        expect.objectContaining({ reportId: 'r-other' }),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears stale action errors before a new verify attempt', async () => {
    mockVerifyReport.mockRejectedValueOnce(new Error('Old verify failure'))
    renderSelectedReport({
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

    // Open confirmation modal and confirm verify
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' })
    expect(verifyButtons.length).toBe(2)
    fireEvent.click(verifyButtons[1]!)

    await flushPromises()
    expect(screen.getByRole('alert')).toHaveTextContent('Old verify failure')

    let resolveVerify: ((value: unknown) => void) | undefined
    mockVerifyReport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve
        }),
    )

    // Click TriagePanel Verify again: error should clear immediately when modal opens
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => {
      resolveVerify?.({})
      await Promise.resolve()
    })
  })
})
