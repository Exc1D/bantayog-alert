import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

vi.mock('../services/callables', () => ({
  callables: {
    escalateDispatch: mockEscalateDispatch,
    dispatchResponder: mockDispatchResponder,
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

  it('dismisses dispatch error banner when dismiss clicked', async () => {
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

    const errorBanner = screen
      .getAllByRole('alert')
      .find((el) => el.textContent.includes('Responder offline'))!
    fireEvent.click(within(errorBanner).getByRole('button', { name: /dismiss/i }))

    await waitFor(() => {
      expect(
        screen.queryAllByRole('alert').some((el) => el.textContent.includes('Responder offline')),
      ).toBe(false)
    })
  })
})
