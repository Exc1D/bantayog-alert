import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

const mockVerifyReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'VERIFIED', reportId: 'r1' }),
)
const mockRejectReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'REJECTED', reportId: 'r1' }),
)

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    rejectReport: mockRejectReport,
  },
}))

const mockPlay = vi.hoisted(() => vi.fn())
const mockPlayError = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useAudioAlerts', () => ({
  useAudioAlerts: () => ({
    enabled: false,
    toggle: vi.fn(),
    play: mockPlay,
    playError: mockPlayError,
  }),
}))

const mockSendSync = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: mockSendSync,
    subscribe: mockSubscribe,
  }),
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
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
    responders: [],
  }),
}))

describe('DashboardPage Firestore wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('renders reports from Firestore hook', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Use getAllByText since 'Daet' appears in both TriageQueueTable and MunicipalPerformanceTable
    expect(screen.getAllByText('Daet').length).toBeGreaterThanOrEqual(1)
  })

  it('calls verifyReport callable on verify', async () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // TriageQueueTable uses aria-label="Verify" on the check button
    fireEvent.click(screen.getByLabelText('Verify'))
    // Verify opens confirmation modal - click Verify inside the dialog
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }))
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledTimes(1)
    })
    expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r1' }))
  })

  it('sends cross-window sync on row click', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Click the barangay cell (unique to triage table row, not in municipal table)
    fireEvent.click(screen.getByText('Camambugan'))
    expect(mockSendSync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'select:report', reportId: 'r1' }),
    )
  })

  it('shows action error banner on callable failure', async () => {
    mockVerifyReport.mockRejectedValueOnce(new Error('network'))
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.click(screen.getByLabelText('Verify'))
    // Verify opens confirmation modal - click Verify inside the dialog
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('network')
    })
  })
})
