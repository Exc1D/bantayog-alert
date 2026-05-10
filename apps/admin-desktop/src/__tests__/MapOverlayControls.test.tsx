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
    expect(screen.getByRole('checkbox', { name: 'Heatmap' })).toBeInTheDocument()
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

  it('toggles heatmap checkbox', async () => {
    const user = userEvent.setup()
    const onToggleOverlay = vi.fn()
    render(
      <MapOverlayControls
        activeOverlays={new Set(['all_incidents'])}
        onToggleOverlay={onToggleOverlay}
      />,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Heatmap' }))
    expect(onToggleOverlay).toHaveBeenCalledWith('heatmap')
  })

  it('expands secondary toggles when More clicked', async () => {
    const user = userEvent.setup()
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    expect(screen.queryByRole('checkbox', { name: 'Responder Locations' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('checkbox', { name: 'Responder Locations' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Provincial Resources' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Municipal Labels' })).toBeInTheDocument()
  })

  it('has minimum 44px hit targets', () => {
    render(
      <MapOverlayControls activeOverlays={new Set(['all_incidents'])} onToggleOverlay={vi.fn()} />,
    )
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
  })
})
