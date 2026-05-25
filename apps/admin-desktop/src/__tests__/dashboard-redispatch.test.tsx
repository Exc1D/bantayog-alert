import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

const mockRedispatchReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    newDispatchId: 'd-new',
    status: 'pending',
    reportId: 'r1',
  }),
)

vi.mock('../services/callables', () => ({
  callables: {
    redispatchReport: mockRedispatchReport,
  },
}))

const mockUseDispatchLifecycle = vi.hoisted(() => vi.fn())
const mockUseResponderFleet = vi.hoisted(() => vi.fn())
const mockUseOpsMetrics = vi.hoisted(() => vi.fn())
const mockUseFirestoreListeners = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: mockUseDispatchLifecycle,
}))

vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: mockUseResponderFleet,
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: mockUseOpsMetrics,
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: mockUseFirestoreListeners,
}))

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    dispatchId: overrides.dispatchId ?? 'd1',
    reportId: overrides.reportId ?? 'rep-12345-abcde',
    status: overrides.status ?? 'needs_admin',
    responderName: overrides.responderName ?? 'Juan Dela Cruz',
    responderAgency: overrides.responderAgency ?? 'BFP',
    dispatchedAt: overrides.dispatchedAt ?? Date.now(),
    deadlineAt: overrides.deadlineAt ?? Date.now() + 3600000,
    escalationCount: overrides.escalationCount ?? 1,
    fcmResult: overrides.fcmResult ?? null,
    fcmWarnings: overrides.fcmWarnings ?? null,
    timeline: overrides.timeline ?? [],
    assignedTo: overrides.assignedTo ?? { uid: 'r1' },
    previouslyNotifiedResponderUids: overrides.previouslyNotifiedResponderUids ?? [],
  }
}

const defaultRows = [makeRow()]

const defaultResponders = [
  {
    uid: 'r1',
    displayName: 'Alice',
    availabilityStatus: 'available' as const,
    lastSeenAt: Date.now(),
    onlineStatus: 'online' as const,
  },
]

describe('DashboardPage re-dispatch', () => {
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
    mockUseDispatchLifecycle.mockReturnValue({ rows: defaultRows, loading: false, error: null })
    mockUseResponderFleet.mockReturnValue({
      responders: defaultResponders,
      loading: false,
      error: null,
    })
    mockUseOpsMetrics.mockReturnValue({
      metrics: {
        avgAcceptSeconds: 42,
        fcmSuccessRate: 0.95,
        totalDispatches: 100,
        acceptedCount: 80,
        declinedCount: 10,
        escalatedCount: 5,
        needsAdminCount: 5,
      },
      loading: false,
      error: null,
    })
    mockUseFirestoreListeners.mockReturnValue({
      reports: [],
      loading: false,
      error: null,
    })
  })

  it('opens ReDispatchModal when Re-dispatch button is clicked', async () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: /re-dispatch/i })).toBeInTheDocument()
  })

  it('calls redispatchReport and shows success banner on dispatch', async () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    await waitFor(() => {
      expect(mockRedispatchReport).toHaveBeenCalledTimes(1)
    })

    expect(mockRedispatchReport).toHaveBeenCalledWith(
      expect.objectContaining({
        oldDispatchId: 'd1',
        newResponderUid: 'r1',
        reason: 'Re-dispatched via dashboard',
        idempotencyKey: expect.any(String),
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(
      screen
        .getAllByRole('status')
        .some((el) => el.textContent.includes('Re-dispatched successfully')),
    ).toBe(true)
  })

  it('shows error banner when redispatchReport fails', async () => {
    mockRedispatchReport.mockRejectedValueOnce(new Error('Responder offline'))
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    await waitFor(() => {
      expect(screen.getByText(/responder offline/i)).toBeInTheDocument()
    })
  })
})
