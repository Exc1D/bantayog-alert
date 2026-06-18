import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapOverlayControls } from '../components/MapOverlayControls'

describe('MapOverlayControls', () => {
  it('renders primary toggles', () => {
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active Only' })).toBeInTheDocument()
  })

  it('does not render dead overlay checkboxes (Heatmap / Responder Locations / Municipal Labels)', () => {
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    expect(screen.queryByLabelText('Heatmap')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Responder Locations')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Municipal Labels')).not.toBeInTheDocument()
  })

  it('does not render a More button (removed with dead checkboxes)', () => {
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument()
  })

  it('shows All as active when all_incidents is in overlays', () => {
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn).toHaveAttribute('aria-pressed', 'true')
    const activeBtn = screen.getByRole('button', { name: 'Active Only' })
    expect(activeBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles from All to Active Only', async () => {
    const user = userEvent.setup()
    const onToggleOverlay = vi.fn()
    render(
      <MapOverlayControls
        activeOverlays={new Set(['all_incidents'])}
        onToggleOverlay={onToggleOverlay}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Active Only' }))
    expect(onToggleOverlay).toHaveBeenCalledWith('all_incidents')
    expect(onToggleOverlay).toHaveBeenCalledWith('active_only')
  })

  it('does nothing when clicking already-active segment', async () => {
    const user = userEvent.setup()
    const onToggleOverlay = vi.fn()
    render(
      <MapOverlayControls
        activeOverlays={new Set(['all_incidents'])}
        onToggleOverlay={onToggleOverlay}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(onToggleOverlay).not.toHaveBeenCalled()
  })

  it('has minimum 44px hit targets', () => {
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
  })
})
