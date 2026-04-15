/**
 * QuickStatusButtons Component Tests
 *
 * Tests that the component renders four buttons, calls useQuickStatus internally,
 * disables buttons appropriately, and wires to the correct dispatch ID.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickStatusButtons } from '../QuickStatusButtons'
import { useQuickStatus } from '../../hooks/useQuickStatus'

// Auto-mock the entire module — useQuickStatus becomes a callable vi.fn mock
// with .mockReturnValue() available. This is the same pattern used in DispatchList.test.tsx.
vi.mock('../../hooks/useQuickStatus')

describe('QuickStatusButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: idle state, no pending items
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map(),
    })
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  it('should render all four status buttons', () => {
    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    expect(screen.getByRole('button', { name: /en route/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /on scene/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /request assistance/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /complete/i })).toBeTruthy()
  })

  it('should render four buttons with the completed button last', () => {
    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    // The "Complete" button should be the last one rendered in the DOM order
    expect(buttons[3].textContent).toBe('Complete')
  })

  // ── useQuickStatus wiring ───────────────────────────────────────────────────

  it('should call useQuickStatus internally (component calls hook at top level)', () => {
    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    expect(useQuickStatus).toHaveBeenCalledTimes(1)
  })

  it('should call updateStatus with correct dispatchId and status when En Route clicked', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: mockUpdateStatus,
      isUpdating: false,
      pendingStatus: new Map(),
    })

    render(<QuickStatusButtons dispatchId="dispatch-42" />)

    await user.click(screen.getByRole('button', { name: /en route/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'en_route')
  })

  it('should call updateStatus with correct dispatchId and status for On Scene', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: mockUpdateStatus,
      isUpdating: false,
      pendingStatus: new Map(),
    })

    render(<QuickStatusButtons dispatchId="dispatch-42" />)

    await user.click(screen.getByRole('button', { name: /on scene/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'on_scene')
  })

  it('should call updateStatus with correct dispatchId and status for Request Assistance', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: mockUpdateStatus,
      isUpdating: false,
      pendingStatus: new Map(),
    })

    render(<QuickStatusButtons dispatchId="dispatch-42" />)

    await user.click(screen.getByRole('button', { name: /request assistance/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'needs_assistance')
  })

  it('should call updateStatus with correct dispatchId and status for Complete', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: mockUpdateStatus,
      isUpdating: false,
      pendingStatus: new Map(),
    })

    render(<QuickStatusButtons dispatchId="dispatch-42" />)

    await user.click(screen.getByRole('button', { name: /complete/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'completed')
  })

  // ── Disabled states ───────────────────────────────────────────────────────

  it('should disable all buttons when isUpdating is true', () => {
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: true,   // global update in progress
      pendingStatus: new Map(),
    })

    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('should disable all buttons when this dispatch has a pending status', () => {
    const pendingMap = new Map<string, string>([['dispatch-1', 'en_route']])
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: pendingMap,  // this dispatch has a pending optimistic update
    })

    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('should NOT disable buttons when a different dispatch is pending', () => {
    // dispatch-1 is clear, but dispatch-2 has a pending update
    const pendingMap = new Map<string, string>([['dispatch-2', 'on_scene']])
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: pendingMap,
    })

    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled()
    })
  })

  it('should not call updateStatus when disabled due to isUpdating', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    ;(useQuickStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      updateStatus: mockUpdateStatus,
      isUpdating: true,
      pendingStatus: new Map(),
    })

    render(<QuickStatusButtons dispatchId="dispatch-1" />)

    // Click each button — HTML button disabled attribute prevents the click handler from firing
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      await user.click(btn)
    }

    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })
})