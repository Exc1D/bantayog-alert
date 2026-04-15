/**
 * QuickStatusButtons Component Tests
 *
 * Tests that the component renders four buttons, accepts the quickStatus
 * controller via prop (not hook), disables appropriately, and wires to
 * the correct dispatch ID.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickStatusButtons } from '../QuickStatusButtons'
import type { QuickStatus } from '../../types'

// Helper to build a fresh controller object for each test
function makeController(overrides: {
  updateStatus?: typeof vi.fn
  isUpdating?: boolean
  pendingStatus?: Map<string, QuickStatus>
} = {}) {
  return {
    updateStatus: overrides.updateStatus ?? vi.fn(),
    isUpdating: overrides.isUpdating ?? false,
    pendingStatus: overrides.pendingStatus ?? new Map(),
  }
}

describe('QuickStatusButtons', () => {
  // ── Render ─────────────────────────────────────────────────────────────────

  it('should render all four status buttons', () => {
    render(<QuickStatusButtons dispatchId="dispatch-1" quickStatus={makeController()} />)

    expect(screen.getByRole('button', { name: /en route/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /on scene/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /request assistance/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /complete/i })).toBeTruthy()
  })

  it('should render four buttons with the completed button last', () => {
    render(<QuickStatusButtons dispatchId="dispatch-1" quickStatus={makeController()} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    // The "Complete" button should be the last one rendered in the DOM order
    expect(buttons[3].textContent).toBe('Complete')
  })

  // ── Status updates ────────────────────────────────────────────────────────

  it('should call updateStatus with correct dispatchId and status when En Route clicked', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    const controller = makeController({ updateStatus: mockUpdateStatus })

    render(<QuickStatusButtons dispatchId="dispatch-42" quickStatus={controller} />)

    await user.click(screen.getByRole('button', { name: /en route/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'en_route')
  })

  it('should call updateStatus with correct dispatchId and status for On Scene', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    const controller = makeController({ updateStatus: mockUpdateStatus })

    render(<QuickStatusButtons dispatchId="dispatch-42" quickStatus={controller} />)

    await user.click(screen.getByRole('button', { name: /on scene/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'on_scene')
  })

  it('should call updateStatus with correct dispatchId and status for Request Assistance', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    const controller = makeController({ updateStatus: mockUpdateStatus })

    render(<QuickStatusButtons dispatchId="dispatch-42" quickStatus={controller} />)

    await user.click(screen.getByRole('button', { name: /request assistance/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'needs_assistance')
  })

  it('should call updateStatus with correct dispatchId and status for Complete', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    const controller = makeController({ updateStatus: mockUpdateStatus })

    render(<QuickStatusButtons dispatchId="dispatch-42" quickStatus={controller} />)

    await user.click(screen.getByRole('button', { name: /complete/i }))

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-42', 'completed')
  })

  // ── Disabled states ───────────────────────────────────────────────────────

  it('should disable all buttons when isUpdating is true', () => {
    const controller = makeController({ isUpdating: true })

    render(<QuickStatusButtons dispatchId="dispatch-1" quickStatus={controller} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('should disable all buttons when this dispatch has a pending status', () => {
    const pendingMap = new Map<string, QuickStatus>([['dispatch-1', 'en_route']])
    const controller = makeController({ pendingStatus: pendingMap })

    render(<QuickStatusButtons dispatchId="dispatch-1" quickStatus={controller} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('should NOT disable buttons when a different dispatch is pending', () => {
    // dispatch-1 is clear, but dispatch-2 has a pending update
    const pendingMap = new Map<string, QuickStatus>([['dispatch-2', 'on_scene']])
    const controller = makeController({ pendingStatus: pendingMap })

    render(<QuickStatusButtons dispatchId="dispatch-1" quickStatus={controller} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled()
    })
  })

  it('should not call updateStatus when disabled due to isUpdating', async () => {
    const user = userEvent.setup()
    const mockUpdateStatus = vi.fn()
    const controller = makeController({ updateStatus: mockUpdateStatus, isUpdating: true })

    render(<QuickStatusButtons dispatchId="dispatch-1" quickStatus={controller} />)

    // Click each button — HTML button disabled attribute prevents the click handler from firing
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      await user.click(btn)
    }

    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  // ── Guard against invalid dispatchId ─────────────────────────────────────

  it('should disable buttons when dispatchId is whitespace', () => {
    const controller = makeController()

    // @ts-expect-error — runtime guard test: invalid id should be handled
    render(<QuickStatusButtons dispatchId="   " quickStatus={controller} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })
})