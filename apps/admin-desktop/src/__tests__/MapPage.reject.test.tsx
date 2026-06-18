import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'

// REQUIRED: MapPage → services/callables → app/firebase → getAuth(firebaseApp) throws
// without VITE_FIREBASE_API_KEY in test env. Mock to prevent crash at import.
vi.mock('../app/firebase', () => ({ db: {} }))

const mockRejectReport = vi.hoisted(() => vi.fn().mockResolvedValue({ reportId: 'r1' }))
const mockVerifyReport = vi.hoisted(() => vi.fn().mockResolvedValue({ reportId: 'r1' }))

vi.mock('../services/callables', () => ({
  callables: {
    rejectReport: mockRejectReport,
    verifyReport: mockVerifyReport,
    dispatchResponder: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r1',
        type: 'fire',
        status: 'awaiting_verify',
        severity: 'high',
        municipality: 'daet',
        barangay: 'poblacion',
        description: 'Test fire',
        createdAt: '2026-06-15T00:00:00Z',
        submittedAt: '2026-06-15T00:00:00Z',
        updatedAt: '2026-06-15T00:00:00Z',
        agencyId: 'bfp-daet',
        publicRef: 'TEST-001',
        reporterUid: 'user1',
        hasMedia: false,
        latitude: 14.1,
        longitude: 122.9,
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
}))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {
      /* unsubscribe */
    }),
  }),
}))

// Render with the report selected so the TriagePanel shows the Reject button.
// We do this by controlling the store directly.
vi.mock('../stores/commandCenterStore', () => {
  return {
    useCommandCenterStore: () => ({
      selectedReportId: 'r1',
      selectedMunicipalityId: null,
      selectReport: vi.fn(),
      selectMunicipality: vi.fn(),
      activeOverlays: new Set<string>(),
      toggleOverlay: vi.fn(),
    }),
  }
})

vi.mock('../hooks/useUrlSync', () => ({
  useUrlSync: () => undefined,
}))

function renderMapPage() {
  return render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  )
}

describe('MapPage — reject guard (3c-18)', () => {
  beforeEach(() => {
    mockRejectReport.mockClear()
    mockVerifyReport.mockClear()
  })

  it('does NOT call rejectReport immediately when the operator clicks Reject', async () => {
    renderMapPage()

    const panelRejectBtn = await screen.findByRole('button', { name: /^reject$/i })
    fireEvent.click(panelRejectBtn)

    // rejectReport must not have been called yet — modal opened instead
    expect(mockRejectReport).not.toHaveBeenCalled()
  })

  it('opens the Reject Report confirmation modal when Reject is clicked', async () => {
    renderMapPage()

    const panelRejectBtn = await screen.findByRole('button', { name: /^reject$/i })
    fireEvent.click(panelRejectBtn)

    // The modal should be visible
    expect(screen.getByRole('dialog', { name: /reject report/i })).toBeInTheDocument()
  })

  it('calls rejectReport only after the operator confirms, with the selected reason', async () => {
    renderMapPage()

    // Click the panel's Reject button (the one inside the triage panel, not a modal)
    const panelRejectBtn = await screen.findByRole('button', {
      name: /^reject$/i,
    })
    // There should only be one Reject button at this point (no modal yet)
    fireEvent.click(panelRejectBtn)

    // The modal dialog should now be visible
    const dialog = screen.getByRole('dialog', { name: /reject report/i })

    // Select 'duplicate' to prove the chosen reason (not the hardcoded 'obviously_false') is sent
    const reasonSelect = within(dialog).getByRole('combobox', { name: /rejection reason/i })
    fireEvent.change(reasonSelect, { target: { value: 'duplicate' } })

    // Confirm — use within(dialog) to scope to the modal's Reject button
    const confirmBtn = within(dialog).getByRole('button', { name: /^reject$/i })
    act(() => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(mockRejectReport).toHaveBeenCalledTimes(1)
    })

    const payload = mockRejectReport.mock.calls[0]?.[0] as {
      reportId: string
      reason: string
      idempotencyKey: string
    }
    expect(payload.reportId).toBe('r1')
    expect(payload.reason).toBe('duplicate')
    // The old hardcoded value must never be sent when the operator picked something else
    expect(payload.reason).not.toBe('obviously_false')
  })

  it('calls rejectReport with the default reason (insufficient_detail) when no change is made', async () => {
    renderMapPage()

    const panelRejectBtn = await screen.findByRole('button', { name: /^reject$/i })
    fireEvent.click(panelRejectBtn)

    // Confirm without changing the reason — default must be 'insufficient_detail'
    const dialog = screen.getByRole('dialog', { name: /reject report/i })
    const confirmBtn = within(dialog).getByRole('button', { name: /^reject$/i })
    act(() => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(mockRejectReport).toHaveBeenCalledTimes(1)
    })

    const payload = mockRejectReport.mock.calls[0]?.[0] as {
      reportId: string
      reason: string
    }
    expect(payload.reason).toBe('insufficient_detail')
    expect(payload.reason).not.toBe('obviously_false')
  })

  it('closes the modal and does NOT call rejectReport when Cancel is clicked', async () => {
    renderMapPage()

    const panelRejectBtn = await screen.findByRole('button', { name: /^reject$/i })
    fireEvent.click(panelRejectBtn)

    const dialog = screen.getByRole('dialog', { name: /reject report/i })
    expect(dialog).toBeInTheDocument()

    const cancelBtn = within(dialog).getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /reject report/i })).not.toBeInTheDocument()
    })
    expect(mockRejectReport).not.toHaveBeenCalled()
  })
})
