import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import {
  BrowserRouterWrapper,
  makeRow,
  defaultResponders,
  defaultMetrics,
  defaultFirestoreListeners,
} from '../test-utils'

const mockRedispatchReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    newDispatchId: 'd-new',
    status: 'pending',
    reportId: 'r1',
  }),
)

vi.mock('../providers/WindowSyncProvider', async () =>
  (await import('../test-utils')).createWindowSyncProviderModuleMock(),
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
    })
    mockUseDispatchLifecycle.mockReturnValue({
      rows: [makeRow({ status: 'needs_admin' })],
      loading: false,
      error: null,
    })
    mockUseResponderFleet.mockReturnValue({
      responders: defaultResponders,
      loading: false,
      error: null,
    })
    mockUseOpsMetrics.mockReturnValue(defaultMetrics)
    mockUseFirestoreListeners.mockReturnValue(defaultFirestoreListeners)
  })

  it('opens ReDispatchModal when Re-dispatch button is clicked', async () => {
    render(<DashboardPage />, { wrapper: BrowserRouterWrapper })
    fireEvent.click(screen.getByRole('button', { name: /re-dispatch/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: /re-dispatch/i })).toBeInTheDocument()
  })

  it('calls redispatchReport and shows success banner on dispatch', async () => {
    render(<DashboardPage />, { wrapper: BrowserRouterWrapper })
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
    render(<DashboardPage />, { wrapper: BrowserRouterWrapper })
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
