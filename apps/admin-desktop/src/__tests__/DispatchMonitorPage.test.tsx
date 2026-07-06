import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DispatchMonitorPage } from '../pages/DispatchMonitorPage'
import { MemoryRouterWrapper, makeRow, defaultRows, defaultResponders } from '../test-utils'

const mockEscalateDispatch = vi.hoisted(() =>
  vi
    .fn()
    .mockResolvedValue({ dispatchId: 'd1', status: 'pending', reportId: 'r1', fcmResult: 'sent' }),
)
const mockDispatchResponder = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ dispatchId: 'd-new', status: 'pending', reportId: 'rep-assign-1' }),
)
const mockCancelDispatch = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ dispatchId: 'd1', status: 'cancelled' }),
)
const mockSuspendResponder = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ uid: 'r1', status: 'suspended' }),
)
const mockRevokeResponder = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ uid: 'r1', status: 'revoked' }),
)
const mockBulkAvailabilityOverride = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ updated: 1, skipped: 0, skippedUids: [] }),
)

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    signOut: () => undefined,
    loading: false,
    claims: { role: 'agency_admin', agencyId: 'bfp-daet', accountStatus: 'active' },
  }),
}))

vi.mock('../services/callables', () => ({
  callables: {
    escalateDispatch: mockEscalateDispatch,
    dispatchResponder: mockDispatchResponder,
    cancelDispatch: mockCancelDispatch,
    suspendResponder: mockSuspendResponder,
    revokeResponder: mockRevokeResponder,
    bulkAvailabilityOverride: mockBulkAvailabilityOverride,
    createResponder: vi.fn().mockResolvedValue({ uid: 'new-responder' }),
    getOpsMetrics: vi.fn().mockResolvedValue({
      metrics: {
        avgAcceptSeconds: 42,
        fcmSuccessRate: 0.95,
        totalDispatches: 100,
        acceptedCount: 80,
        declinedCount: 10,
        escalatedCount: 5,
        needsAdminCount: 5,
      },
    }),
  },
}))

const mockGetFirestoreInstance = vi.hoisted(() => vi.fn(() => ({})))

vi.mock('../app/firebase', () => ({
  getFirestoreInstance: mockGetFirestoreInstance,
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

async function tabUntil(
  user: ReturnType<typeof userEvent.setup>,
  getExpectedElement: () => HTMLElement,
  maxTabs = 20,
) {
  for (let index = 0; index < maxTabs; index += 1) {
    await user.tab()
    if (document.activeElement === getExpectedElement()) {
      return
    }
  }

  throw new Error('Could not focus expected element by tabbing')
}

async function openResponderActionDialog(actionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: /View Alice responder details/i }))
  fireEvent.click(screen.getByRole('button', { name: actionLabel }))
  return within(await screen.findByRole('dialog'))
}

describe('DispatchMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDispatchLifecycle.mockReturnValue({ rows: defaultRows, loading: false, error: null })
    mockUseResponderFleet.mockReturnValue({
      responders: defaultResponders,
      loading: false,
      error: null,
    })
    mockUseFirestoreListeners.mockReturnValue({
      reports: [],
      loading: false,
      error: null,
      reportOps: [],
      alerts: [],
      situationUpdates: [],
      responders: [],
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
  })

  it('shows loading spinner when dispatch lifecycle is loading', () => {
    mockUseDispatchLifecycle.mockReturnValue({ rows: [], loading: true, error: null })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows ActionErrorBanner when dispatch lifecycle errors', () => {
    mockUseDispatchLifecycle.mockReturnValue({ rows: [], loading: false, error: 'network error' })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    expect(screen.getByRole('alert')).toHaveTextContent(/network error/i)
  })

  it('renders all sections when data is loaded', () => {
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    expect(screen.getByLabelText('Active Now')).toBeInTheDocument()
    expect(screen.getByText('Report')).toBeInTheDocument()
    expect(screen.getByText(/responders/i)).toBeInTheDocument()
  })

  it('shows a responder status queue for active field progress', () => {
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-en-route',
          reportId: 'rep-en-route',
          status: 'en_route',
          responderName: 'Alice Responder',
          responderAgency: 'BFP',
        }),
        makeRow({
          dispatchId: 'd-on-scene',
          reportId: 'rep-on-scene',
          status: 'on_scene',
          responderName: 'Ben Responder',
          responderAgency: 'MDRRMO',
        }),
      ],
      loading: false,
      error: null,
    })

    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const queue = screen.getByLabelText('Responder status queue')
    expect(within(queue).getByText('Alice Responder')).toBeInTheDocument()
    expect(within(queue).getByText('En route')).toBeInTheDocument()
    expect(within(queue).getByText('Ben Responder')).toBeInTheDocument()
    expect(within(queue).getByText('On scene')).toBeInTheDocument()
  })

  it('maps backend acknowledgement deadlines into dispatch rows', async () => {
    const { resolveDispatchDeadlineAt } = await vi.importActual<
      typeof import('../hooks/useDispatchLifecycle')
    >('../hooks/useDispatchLifecycle')

    expect(resolveDispatchDeadlineAt({ acknowledgementDeadlineAt: 1234 })).toBe(1234)
    expect(resolveDispatchDeadlineAt({ deadlineAt: 5678 })).toBe(5678)
  })

  it('shows a live SLA countdown and overdue state for pending acknowledgements', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-13T04:00:00.000Z'))

    try {
      const now = Date.now()
      mockUseDispatchLifecycle.mockReturnValue({
        rows: [
          makeRow({
            dispatchId: 'd-pending',
            reportId: 'rep-pending',
            status: 'pending',
            responderName: 'Alice Responder',
            deadlineAt: now + 125_000,
          }),
          makeRow({
            dispatchId: 'd-accepted',
            reportId: 'rep-accepted',
            status: 'accepted',
            responderName: 'Ben Responder',
            deadlineAt: now - 65_000,
          }),
          makeRow({
            dispatchId: 'd-acknowledged',
            reportId: 'rep-acknowledged',
            status: 'acknowledged',
            responderName: 'Cora Responder',
            deadlineAt: now - 65_000,
          }),
        ],
        loading: false,
        error: null,
      })

      render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

      const queue = screen.getByLabelText('Responder status queue')
      expect(within(queue).getByText('Alice Responder')).toBeInTheDocument()
      expect(within(queue).getByLabelText('SLA due in 3m')).toHaveTextContent('SLA 3m left')
      expect(within(queue).getByLabelText('SLA overdue by 2m')).toHaveTextContent(
        'SLA Overdue by 2m',
      )
      expect(
        within(queue).queryByLabelText('SLA overdue by 2m', {
          selector: '[data-dispatch-id="d-acknowledged"] *',
        }),
      ).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000)
      })

      expect(within(queue).getByLabelText('SLA due in 2m')).toHaveTextContent('SLA 2m left')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows recently resolved dispatches outside active responder queues', () => {
    const resolvedAt = new Date(2026, 5, 13, 4, 15).getTime()
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-active',
          reportId: 'rep-active',
          status: 'on_scene',
          responderName: 'Alice Responder',
        }),
        makeRow({
          dispatchId: 'd-resolved',
          reportId: 'rep-resolved',
          status: 'resolved',
          responderName: 'Ben Responder',
          responderAgency: 'MDRRMO',
          resolvedAt,
          resolutionSummary: 'Water cleared from the evacuation route.',
        }),
      ],
      loading: false,
      error: null,
    })

    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const statusQueue = screen.getByLabelText('Responder status queue')
    expect(within(statusQueue).getByText('1 active')).toBeInTheDocument()
    expect(within(statusQueue).queryByText('Ben Responder')).not.toBeInTheDocument()

    const resolvedSection = screen.getByLabelText('Recently resolved dispatches')
    expect(within(resolvedSection).getByText('Ben Responder')).toBeInTheDocument()
    expect(
      within(resolvedSection).getByText('Water cleared from the evacuation route.'),
    ).toBeInTheDocument()
    expect(within(resolvedSection).getByText(/Resolved .*4:15 AM/)).toBeInTheDocument()
  })

  it('assigns a verified report to a responder from the dispatch screen', async () => {
    mockUseFirestoreListeners.mockReturnValue({
      reports: [
        {
          id: 'rep-assign-1',
          reportType: 'flood',
          severity: 'high',
          municipalityLabel: 'Daet',
          municipalityId: 'daet',
          barangayId: 'Camambugan',
          submittedAt: Date.now(),
          status: 'verified',
          description: 'Water rising near the bridge',
          publicLocation: { lat: 14.1, lng: 122.9 },
        },
      ],
      loading: false,
      error: null,
      reportOps: [],
      alerts: [],
      situationUpdates: [],
      responders: [],
    })
    mockUseResponderFleet.mockReturnValue({
      responders: [{ ...defaultResponders[0]!, municipalityId: 'daet' }],
      loading: false,
      error: null,
    })

    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const queue = screen.getByLabelText('Responder assignment queue')
    expect(within(queue).getByText('Water rising near the bridge')).toBeInTheDocument()

    fireEvent.change(within(queue).getByLabelText(/responder for rep-assign-1/i), {
      target: { value: 'r1' },
    })
    fireEvent.click(within(queue).getByRole('button', { name: /assign responder/i }))

    await waitFor(() => {
      expect(mockDispatchResponder).toHaveBeenCalledTimes(1)
    })
    expect(mockDispatchResponder).toHaveBeenCalledWith({
      reportId: 'rep-assign-1',
      responderUid: 'r1',
      idempotencyKey: expect.any(String),
    })
    await waitFor(() => {
      expect(screen.getByText('Responder assigned')).toBeInTheDocument()
    })
  })

  it('retries a failed responder assignment with the original payload', async () => {
    mockDispatchResponder.mockRejectedValueOnce(new Error('Network split'))
    mockUseFirestoreListeners.mockReturnValue({
      reports: [
        {
          id: 'rep-assign-1',
          reportType: 'flood',
          severity: 'high',
          municipalityLabel: 'Daet',
          municipalityId: 'daet',
          barangayId: 'Camambugan',
          submittedAt: Date.now(),
          status: 'verified',
          description: 'Water rising near the bridge',
          publicLocation: { lat: 14.1, lng: 122.9 },
        },
      ],
      loading: false,
      error: null,
      reportOps: [],
      alerts: [],
      situationUpdates: [],
      responders: [],
    })
    mockUseResponderFleet.mockReturnValue({
      responders: [{ ...defaultResponders[0]!, municipalityId: 'daet' }],
      loading: false,
      error: null,
    })

    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const queue = screen.getByLabelText('Responder assignment queue')
    fireEvent.change(within(queue).getByLabelText(/responder for rep-assign-1/i), {
      target: { value: 'r1' },
    })
    fireEvent.click(within(queue).getByRole('button', { name: /assign responder/i }))

    await waitFor(() => {
      expect(mockDispatchResponder).toHaveBeenCalledTimes(1)
    })
    const firstPayload = mockDispatchResponder.mock.calls[0]?.[0]
    const retryButton = await screen.findByRole('button', { name: 'Retry command' })
    expect(retryButton).toBeEnabled()

    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(mockDispatchResponder).toHaveBeenCalledTimes(2)
    })
    expect(mockDispatchResponder.mock.calls[1]?.[0]).toEqual(firstPayload)
    await waitFor(() => {
      expect(screen.getByText('Responder assigned')).toBeInTheDocument()
    })
  })

  it('cancels a dispatch through the confirmation modal with the chosen reason', async () => {
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    // Expand the pending (cancellable) lifecycle row to reveal its Cancel button
    fireEvent.click(screen.getByRole('row'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel dispatch' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/reason/i), {
      target: { value: 'duplicate_report' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel dispatch' }))

    await waitFor(() => {
      expect(mockCancelDispatch).toHaveBeenCalledTimes(1)
    })
    expect(mockCancelDispatch).toHaveBeenCalledWith({
      dispatchId: 'd1',
      reason: 'duplicate_report',
      idempotencyKey: expect.any(String),
    })
    await waitFor(() => {
      expect(screen.getByText('Dispatch cancelled')).toBeInTheDocument()
    })
  })

  it('suspends a responder through the confirmation modal (agency_admin)', async () => {
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const dialog = await openResponderActionDialog('Suspend')
    fireEvent.click(dialog.getByRole('button', { name: 'Suspend' }))

    await waitFor(() => {
      expect(mockSuspendResponder).toHaveBeenCalledTimes(1)
    })
    expect(mockSuspendResponder).toHaveBeenCalledWith({
      uid: 'r1',
      idempotencyKey: expect.any(String),
    })
    await waitFor(() => {
      expect(screen.getByText('Responder suspended')).toBeInTheDocument()
    })
  })

  it('revokes responder access through the confirmation modal (agency_admin)', async () => {
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const dialog = await openResponderActionDialog('Revoke')
    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(mockRevokeResponder).toHaveBeenCalledWith({
        uid: 'r1',
        idempotencyKey: expect.any(String),
      })
    })
  })

  it('sets a responder off-duty through the confirmation modal (agency_admin)', async () => {
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const dialog = await openResponderActionDialog('Set off-duty')
    fireEvent.click(dialog.getByRole('button', { name: 'Set off-duty' }))

    await waitFor(() => {
      expect(mockBulkAvailabilityOverride).toHaveBeenCalledWith({
        uids: ['r1'],
        status: 'off_duty',
        idempotencyKey: expect.any(String),
      })
    })
  })

  it('closes the responder modal when an action fails', async () => {
    mockSuspendResponder.mockRejectedValueOnce(new Error('Responder action failed'))
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })

    const dialog = await openResponderActionDialog('Suspend')
    fireEvent.click(dialog.getByRole('button', { name: 'Suspend' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Responder action failed')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show escalation queue when no stalled dispatches', () => {
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    expect(screen.queryByLabelText('Escalation queue')).not.toBeInTheDocument()
  })

  it('shows escalation queue when stalled dispatches exist', () => {
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [makeRow({ status: 'needs_admin', escalationCount: 2 })],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    expect(screen.getByLabelText('Escalation queue')).toBeInTheDocument()
    expect(screen.getByText(/needs admin attention/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /re-dispatch/i })).toBeInTheDocument()
  })

  it('opens re-dispatch modal when re-dispatch button clicked', async () => {
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-stalled',
          status: 'needs_admin',
          reportId: 'rep-stalled-xyz',
          previouslyNotifiedResponderUids: ['r-old'],
        }),
      ],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: /re-dispatch/i })).toBeInTheDocument()
  })

  it('calls escalateDispatch and closes modal on dispatch success', async () => {
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-stalled',
          status: 'needs_admin',
          reportId: 'rep-stalled-xyz',
          previouslyNotifiedResponderUids: [],
        }),
      ],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    await waitFor(() => {
      expect(mockEscalateDispatch).toHaveBeenCalledTimes(1)
    })

    expect(mockEscalateDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 'd-stalled',
        newResponderUid: 'r1',
        idempotencyKey: expect.any(String),
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows dispatch error banner when escalateDispatch fails', async () => {
    mockEscalateDispatch.mockRejectedValueOnce(new Error('Responder offline'))
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-stalled',
          status: 'needs_admin',
          reportId: 'rep-stalled-xyz',
          previouslyNotifiedResponderUids: [],
        }),
      ],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    await waitFor(() => {
      expect(
        screen.getAllByRole('alert').some((el) => el.textContent.includes('Responder offline')),
      ).toBe(true)
    })
  })

  it('retries a failed re-dispatch with the original payload', async () => {
    mockEscalateDispatch.mockRejectedValueOnce(new Error('Responder offline'))
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-stalled',
          status: 'needs_admin',
          reportId: 'rep-stalled-xyz',
          previouslyNotifiedResponderUids: [],
        }),
      ],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    await waitFor(() => {
      expect(mockEscalateDispatch).toHaveBeenCalledTimes(1)
    })
    const firstPayload = mockEscalateDispatch.mock.calls[0]?.[0]
    const retryButton = await screen.findByRole('button', { name: 'Retry command' })
    expect(retryButton).toBeEnabled()

    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(mockEscalateDispatch).toHaveBeenCalledTimes(2)
    })
    expect(mockEscalateDispatch.mock.calls[1]?.[0]).toEqual(firstPayload)
    await waitFor(() => {
      expect(screen.getByText('Re-dispatched successfully')).toBeInTheDocument()
    })
  })

  it('keeps failed re-dispatch retry reachable inside the modal focus trap', async () => {
    const user = userEvent.setup()
    mockEscalateDispatch.mockRejectedValueOnce(new Error('Responder offline'))
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-stalled',
          status: 'needs_admin',
          reportId: 'rep-stalled-xyz',
          previouslyNotifiedResponderUids: [],
        }),
      ],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    const retryButton = await within(dialog).findByRole('button', { name: 'Retry command' })
    expect(within(dialog).getByText('Responder offline')).toBeInTheDocument()
    expect(retryButton).toBeEnabled()

    await tabUntil(user, () => screen.getByRole('button', { name: 'Retry command' }))

    expect(retryButton).toBeEnabled()
  })

  it('clears re-dispatch error when modal is closed', async () => {
    mockEscalateDispatch.mockRejectedValueOnce(new Error('Responder offline'))
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [
        makeRow({
          dispatchId: 'd-stalled',
          status: 'needs_admin',
          reportId: 'rep-stalled-xyz',
          previouslyNotifiedResponderUids: [],
        }),
      ],
      loading: false,
      error: null,
    })
    render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Alice'))
    fireEvent.click(within(dialog).getByRole('button', { name: /dispatch selected/i }))

    await waitFor(() => {
      expect(
        screen.getAllByRole('alert').some((el) => el.textContent.includes('Responder offline')),
      ).toBe(true)
    })

    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }))

    await waitFor(() => {
      expect(
        screen.queryAllByRole('alert').some((el) => el.textContent.includes('Responder offline')),
      ).toBe(false)
    })
  })

  describe('metrics error indicator', () => {
    it('renders a role="status" metrics unavailable indicator when useOpsMetrics returns an error', () => {
      mockUseOpsMetrics.mockReturnValue({
        metrics: null,
        loading: false,
        error: 'Failed to fetch metrics',
      })
      render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
      const statusEls = screen.getAllByRole('status')
      const metricsStatus = statusEls.find((el) =>
        el.textContent.toLowerCase().includes('metrics unavailable'),
      )
      expect(metricsStatus).toBeDefined()
    })

    it('does not render the metrics unavailable indicator when there is no error', () => {
      render(<DispatchMonitorPage />, { wrapper: MemoryRouterWrapper })
      const allStatusEls = screen.queryAllByRole('status')
      const hasMetricsError = allStatusEls.some((el) =>
        el.textContent.toLowerCase().includes('metrics unavailable'),
      )
      expect(hasMetricsError).toBe(false)
    })
  })
})
