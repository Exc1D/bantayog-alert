import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { DispatchMonitorPage } from '../pages/DispatchMonitorPage'
import { MemoryRouterWrapper, makeRow, defaultRows, defaultResponders } from '../test-utils'

const mockEscalateDispatch = vi.hoisted(() =>
  vi
    .fn()
    .mockResolvedValue({ dispatchId: 'd1', status: 'pending', reportId: 'r1', fcmResult: 'sent' }),
)

vi.mock('../services/callables', () => ({
  callables: {
    escalateDispatch: mockEscalateDispatch,
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

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: mockUseDispatchLifecycle,
}))

vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: mockUseResponderFleet,
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: mockUseOpsMetrics,
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
