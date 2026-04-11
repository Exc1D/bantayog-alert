import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import L from 'leaflet'
import { MapControls } from '../MapControls'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Plus: ({ className, strokeWidth }: { className: string; strokeWidth: number }) => (
    <svg data-testid="plus-icon" className={className} strokeWidth={strokeWidth} />
  ),
  Minus: ({ className, strokeWidth }: { className: string; strokeWidth: number }) => (
    <svg data-testid="minus-icon" className={className} strokeWidth={strokeWidth} />
  ),
  Crosshair: ({ className, strokeWidth }: { className: string; strokeWidth: number }) => (
    <svg data-testid="crosshair-icon" className={className} strokeWidth={strokeWidth} />
  ),
  Layers: ({ className, strokeWidth }: { className: string; strokeWidth: number }) => (
    <svg data-testid="layers-icon" className={className} strokeWidth={strokeWidth} />
  ),
}))

describe('MapControls', () => {
  const mockMap = {
    setZoom: vi.fn(),
    flyTo: vi.fn(),
  } as unknown as L.Map

  const defaultProps = {
    map: mockMap,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onLocate: vi.fn(),
    onLayerToggle: vi.fn(),
    currentZoom: 10,
    layerType: 'standard' as const,
    minZoom: 8,
    maxZoom: 18,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render all control buttons', () => {
      render(<MapControls {...defaultProps} />)

      expect(screen.getByTestId('zoom-in-btn')).toBeInTheDocument()
      expect(screen.getByTestId('zoom-out-btn')).toBeInTheDocument()
      expect(screen.getByTestId('locate-btn')).toBeInTheDocument()
      expect(screen.getByTestId('layer-toggle-btn')).toBeInTheDocument()
    })

    it('should render icons for each button', () => {
      render(<MapControls {...defaultProps} />)

      expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
      expect(screen.getByTestId('minus-icon')).toBeInTheDocument()
      expect(screen.getByTestId('crosshair-icon')).toBeInTheDocument()
      expect(screen.getByTestId('layers-icon')).toBeInTheDocument()
    })

    it('should have correct positioning classes', () => {
      const { container } = render(<MapControls {...defaultProps} />)
      const controls = container.querySelector('[data-testid="map-controls"]')

      expect(controls).toHaveClass('absolute', 'top-4', 'right-4', 'z-[1000]', 'flex', 'flex-col')
    })

    it('should have accessible labels', () => {
      render(<MapControls {...defaultProps} />)

      expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
      expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
      expect(screen.getByLabelText('Center on your location')).toBeInTheDocument()
      expect(screen.getByLabelText('Switch to satellite view')).toBeInTheDocument()
    })
  })

  describe('zoom controls', () => {
    it('should enable zoom in when below max zoom', () => {
      render(<MapControls {...defaultProps} currentZoom={10} maxZoom={18} />)

      const zoomInBtn = screen.getByTestId('zoom-in-btn')
      expect(zoomInBtn).not.toBeDisabled()
    })

    it('should disable zoom in at max zoom', () => {
      render(<MapControls {...defaultProps} currentZoom={18} maxZoom={18} />)

      const zoomInBtn = screen.getByTestId('zoom-in-btn')
      expect(zoomInBtn).toBeDisabled()
    })

    it('should enable zoom out when above min zoom', () => {
      render(<MapControls {...defaultProps} currentZoom={10} minZoom={8} />)

      const zoomOutBtn = screen.getByTestId('zoom-out-btn')
      expect(zoomOutBtn).not.toBeDisabled()
    })

    it('should disable zoom out at min zoom', () => {
      render(<MapControls {...defaultProps} currentZoom={8} minZoom={8} />)

      const zoomOutBtn = screen.getByTestId('zoom-out-btn')
      expect(zoomOutBtn).toBeDisabled()
    })

    it('should call onZoomIn when zoom in button is clicked', async () => {
      const user = userEvent.setup()
      const onZoomIn = vi.fn()
      render(<MapControls {...defaultProps} onZoomIn={onZoomIn} currentZoom={10} maxZoom={18} />)

      await user.click(screen.getByTestId('zoom-in-btn'))

      expect(onZoomIn).toHaveBeenCalledTimes(1)
    })

    it('should not call onZoomIn when disabled', async () => {
      const user = userEvent.setup()
      const onZoomIn = vi.fn()
      render(<MapControls {...defaultProps} onZoomIn={onZoomIn} currentZoom={18} maxZoom={18} />)

      await user.click(screen.getByTestId('zoom-in-btn'))

      expect(onZoomIn).not.toHaveBeenCalled()
    })

    it('should call onZoomOut when zoom out button is clicked', async () => {
      const user = userEvent.setup()
      const onZoomOut = vi.fn()
      render(<MapControls {...defaultProps} onZoomOut={onZoomOut} currentZoom={10} minZoom={8} />)

      await user.click(screen.getByTestId('zoom-out-btn'))

      expect(onZoomOut).toHaveBeenCalledTimes(1)
    })

    it('should not call onZoomOut when disabled', async () => {
      const user = userEvent.setup()
      const onZoomOut = vi.fn()
      render(<MapControls {...defaultProps} onZoomOut={onZoomOut} currentZoom={8} minZoom={8} />)

      await user.click(screen.getByTestId('zoom-out-btn'))

      expect(onZoomOut).not.toHaveBeenCalled()
    })
  })

  describe('locate control', () => {
    it('should call onLocate when locate button is clicked', async () => {
      const user = userEvent.setup()
      const onLocate = vi.fn()
      render(<MapControls {...defaultProps} onLocate={onLocate} />)

      await user.click(screen.getByTestId('locate-btn'))

      expect(onLocate).toHaveBeenCalledTimes(1)
    })

    it('should disable locate button when map is null', () => {
      render(<MapControls {...defaultProps} map={null} />)

      const locateBtn = screen.getByTestId('locate-btn')
      expect(locateBtn).toBeDisabled()
    })

    it('should enable locate button when map is available', () => {
      render(<MapControls {...defaultProps} map={mockMap} />)

      const locateBtn = screen.getByTestId('locate-btn')
      expect(locateBtn).not.toBeDisabled()
    })
  })

  describe('layer toggle control', () => {
    it('should call onLayerToggle when layer toggle button is clicked', async () => {
      const user = userEvent.setup()
      const onLayerToggle = vi.fn()
      render(<MapControls {...defaultProps} onLayerToggle={onLayerToggle} layerType="standard" />)

      await user.click(screen.getByTestId('layer-toggle-btn'))

      expect(onLayerToggle).toHaveBeenCalledTimes(1)
    })

    it('should update aria-label based on current layer type', () => {
      const { rerender } = render(<MapControls {...defaultProps} layerType="standard" />)

      expect(screen.getByLabelText('Switch to satellite view')).toBeInTheDocument()

      rerender(<MapControls {...defaultProps} layerType="satellite" />)

      expect(screen.getByLabelText('Switch to standard view')).toBeInTheDocument()
    })

    it('should disable layer toggle when map is null', () => {
      render(<MapControls {...defaultProps} map={null} />)

      const layerToggleBtn = screen.getByTestId('layer-toggle-btn')
      expect(layerToggleBtn).toBeDisabled()
    })

    it('should enable layer toggle when map is available', () => {
      render(<MapControls {...defaultProps} map={mockMap} />)

      const layerToggleBtn = screen.getByTestId('layer-toggle-btn')
      expect(layerToggleBtn).not.toBeDisabled()
    })
  })

  describe('styling', () => {
    it('should apply correct button styles', () => {
      const { container } = render(<MapControls {...defaultProps} />)
      const buttons = container.querySelectorAll('button')

      buttons.forEach((button) => {
        expect(button).toHaveClass(
          'flex',
          'items-center',
          'justify-center',
          'w-10',
          'h-10',
          'bg-white',
          'rounded-lg',
          'shadow-lg'
        )
      })
    })

    it('should add visual divider between zoom and other controls', () => {
      const { container } = render(<MapControls {...defaultProps} />)
      const divider = container.querySelector('.h-px.bg-gray-300')

      expect(divider).toBeInTheDocument()
    })

    it('should apply disabled styling correctly', () => {
      render(<MapControls {...defaultProps} currentZoom={18} maxZoom={18} />)

      const zoomInBtn = screen.getByTestId('zoom-in-btn')
      expect(zoomInBtn).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
    })
  })

  describe('accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      const onZoomIn = vi.fn()
      render(<MapControls {...defaultProps} onZoomIn={onZoomIn} currentZoom={10} maxZoom={18} />)

      const zoomInBtn = screen.getByTestId('zoom-in-btn')
      zoomInBtn.focus()
      expect(zoomInBtn).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(onZoomIn).toHaveBeenCalled()
    })

    it('should have visible focus ring', () => {
      render(<MapControls {...defaultProps} />)

      const zoomInBtn = screen.getByTestId('zoom-in-btn')
      expect(zoomInBtn).toHaveClass('focus:ring-2', 'focus:ring-primary-blue', 'focus:ring-offset-2')
    })

    it('should support all buttons via keyboard', async () => {
      const user = userEvent.setup()
      const onZoomIn = vi.fn()
      const onZoomOut = vi.fn()
      const onLocate = vi.fn()
      const onLayerToggle = vi.fn()

      render(
        <MapControls
          {...defaultProps}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onLocate={onLocate}
          onLayerToggle={onLayerToggle}
          currentZoom={10}
          minZoom={8}
          maxZoom={18}
        />
      )

      // Tab through buttons and activate with Enter
      await user.tab()
      await user.keyboard('{Enter}')
      expect(onZoomIn).toHaveBeenCalled()

      await user.tab()
      await user.keyboard('{Enter}')
      expect(onZoomOut).toHaveBeenCalled()

      await user.tab()
      await user.keyboard('{Enter}')
      expect(onLocate).toHaveBeenCalled()

      await user.tab()
      await user.keyboard('{Enter}')
      expect(onLayerToggle).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle missing optional props', () => {
      render(<MapControls map={mockMap} />)

      expect(screen.getByTestId('map-controls')).toBeInTheDocument()
    })

    it('should handle rapid button clicks', async () => {
      const user = userEvent.setup()
      const onZoomIn = vi.fn()
      render(<MapControls {...defaultProps} onZoomIn={onZoomIn} currentZoom={10} maxZoom={18} />)

      const zoomInBtn = screen.getByTestId('zoom-in-btn')

      await user.click(zoomInBtn)
      await user.click(zoomInBtn)
      await user.click(zoomInBtn)

      expect(onZoomIn).toHaveBeenCalledTimes(3)
    })

    it('should handle all buttons disabled simultaneously', () => {
      render(<MapControls {...defaultProps} map={null} />)

      expect(screen.getByTestId('zoom-in-btn')).toBeDisabled()
      expect(screen.getByTestId('zoom-out-btn')).toBeDisabled()
      expect(screen.getByTestId('locate-btn')).toBeDisabled()
      expect(screen.getByTestId('layer-toggle-btn')).toBeDisabled()
    })

    it('should handle boundary zoom levels', () => {
      const { rerender } = render(<MapControls {...defaultProps} currentZoom={8} minZoom={8} maxZoom={18} />)

      expect(screen.getByTestId('zoom-out-btn')).toBeDisabled()
      expect(screen.getByTestId('zoom-in-btn')).not.toBeDisabled()

      rerender(<MapControls {...defaultProps} currentZoom={18} minZoom={8} maxZoom={18} />)

      expect(screen.getByTestId('zoom-in-btn')).toBeDisabled()
      expect(screen.getByTestId('zoom-out-btn')).not.toBeDisabled()
    })
  })
})
