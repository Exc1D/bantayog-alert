import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CommandCenterShell } from '../components/CommandCenterShell'

const mockFocusMode = {
  focusedZone: null as string | null,
  isFocusModeActive: false,
  enterFocusMode: vi.fn(),
  exitFocusMode: vi.fn(),
}

vi.mock('../hooks/useFocusMode', () => ({
  useFocusMode: () => mockFocusMode,
}))

describe('CommandCenterShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFocusMode.focusedZone = null
    mockFocusMode.isFocusModeActive = false
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all zones by default', () => {
    render(
      <CommandCenterShell
        topBanner={<div data-testid="top-banner">Top Banner</div>}
        mapZone={<div data-testid="map-zone">Map</div>}
        gridZone={<div data-testid="grid-zone">Grid</div>}
        bottomStrip={<div data-testid="bottom-strip">Bottom</div>}
      />,
    )

    expect(screen.getByTestId('top-banner')).toBeInTheDocument()
    expect(screen.getByTestId('map-zone')).toBeInTheDocument()
    expect(screen.getByTestId('grid-zone')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-strip')).toBeInTheDocument()
  })

  it('has main content area', () => {
    render(
      <CommandCenterShell
        topBanner={<div>Top</div>}
        mapZone={<div>Map</div>}
        gridZone={<div>Grid</div>}
        bottomStrip={<div>Bottom</div>}
      />,
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('hides grid zone when map is focused', () => {
    mockFocusMode.focusedZone = 'map'
    mockFocusMode.isFocusModeActive = true

    render(
      <CommandCenterShell
        topBanner={<div>Top</div>}
        mapZone={<div data-testid="map-zone">Map</div>}
        gridZone={<div data-testid="grid-zone">Grid</div>}
        bottomStrip={<div>Bottom</div>}
      />,
    )

    expect(screen.getByTestId('map-zone')).toBeInTheDocument()
    expect(screen.queryByTestId('grid-zone')).not.toBeVisible()
  })

  it('hides map zone when grid is focused', () => {
    mockFocusMode.focusedZone = 'grid'
    mockFocusMode.isFocusModeActive = true

    render(
      <CommandCenterShell
        topBanner={<div>Top</div>}
        mapZone={<div data-testid="map-zone">Map</div>}
        gridZone={<div data-testid="grid-zone">Grid</div>}
        bottomStrip={<div>Bottom</div>}
      />,
    )

    expect(screen.queryByTestId('map-zone')).not.toBeVisible()
    expect(screen.getByTestId('grid-zone')).toBeInTheDocument()
  })

  it('shows exit focus button when in focus mode', () => {
    mockFocusMode.focusedZone = 'map'
    mockFocusMode.isFocusModeActive = true

    render(
      <CommandCenterShell
        topBanner={<div>Top</div>}
        mapZone={<div>Map</div>}
        gridZone={<div>Grid</div>}
        bottomStrip={<div>Bottom</div>}
      />,
    )

    expect(screen.getByTestId('exit-focus-button')).toBeInTheDocument()
    expect(screen.getByText('Exit Focus')).toBeInTheDocument()
  })

  it('does not show exit focus button when not in focus mode', () => {
    mockFocusMode.focusedZone = null
    mockFocusMode.isFocusModeActive = false

    render(
      <CommandCenterShell
        topBanner={<div>Top</div>}
        mapZone={<div>Map</div>}
        gridZone={<div>Grid</div>}
        bottomStrip={<div>Bottom</div>}
      />,
    )

    expect(screen.queryByTestId('exit-focus-button')).not.toBeInTheDocument()
  })

  it('calls exitFocusMode when exit button is clicked', () => {
    mockFocusMode.focusedZone = 'map'
    mockFocusMode.isFocusModeActive = true

    render(
      <CommandCenterShell
        topBanner={<div>Top</div>}
        mapZone={<div>Map</div>}
        gridZone={<div>Grid</div>}
        bottomStrip={<div>Bottom</div>}
      />,
    )

    const exitButton = screen.getByTestId('exit-focus-button')
    exitButton.click()
    expect(mockFocusMode.exitFocusMode).toHaveBeenCalledTimes(1)
  })
})
