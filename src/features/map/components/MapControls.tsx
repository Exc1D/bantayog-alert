import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Plus, Minus, Crosshair, Layers } from 'lucide-react'
import L from 'leaflet'

export interface MapControlsProps {
  map: L.Map | null
  onZoomIn?: () => void
  onZoomOut?: () => void
  onLocate?: () => void
  onLayerToggle?: () => void
  currentZoom?: number
  layerType?: 'standard' | 'satellite'
  minZoom?: number
  maxZoom?: number
}

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
  children: React.ReactNode
}

/**
 * Individual control button component with consistent styling
 */
const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  ({ 'aria-label': ariaLabel, children, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        className={`
          flex items-center justify-center
          w-10 h-10
          bg-white
          rounded-lg
          shadow-lg
          hover:bg-gray-50
          active:bg-gray-100
          transition-colors
          duration-150
          focus:outline-none
          focus:ring-2
          focus:ring-primary-blue
          focus:ring-offset-2
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    )
  }
)

ControlButton.displayName = 'ControlButton'

/**
 * MapControls - Floating control panel for map interactions.
 * Provides zoom in/out, locate user, and layer toggle buttons.
 *
 * Positioned in top-right corner of map with white circular buttons.
 *
 * @param map - Leaflet map instance
 * @param onZoomIn - Handler for zoom in button
 * @param onZoomOut - Handler for zoom out button
 * @param onLocate - Handler for locate button
 * @param onLayerToggle - Handler for layer toggle button
 * @param currentZoom - Current zoom level (for disabling buttons at limits)
 * @param layerType - Current layer type ('standard' | 'satellite')
 * @param minZoom - Minimum zoom level (default: 8)
 * @param maxZoom - Maximum zoom level (default: 18)
 */
export function MapControls({
  map,
  onZoomIn,
  onZoomOut,
  onLocate,
  onLayerToggle,
  currentZoom = 10,
  layerType = 'standard',
  minZoom = 8,
  maxZoom = 18,
}: MapControlsProps) {
  const canZoomIn = currentZoom < maxZoom
  const canZoomOut = currentZoom > minZoom

  return (
    <div
      className="absolute top-4 right-4 z-[1000] flex flex-col gap-2"
      data-testid="map-controls"
    >
      {/* Zoom In Button */}
      <ControlButton
        onClick={onZoomIn}
        disabled={!canZoomIn || !map}
        aria-label="Zoom in"
        data-testid="zoom-in-btn"
      >
        <Plus className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
      </ControlButton>

      {/* Zoom Out Button */}
      <ControlButton
        onClick={onZoomOut}
        disabled={!canZoomOut || !map}
        aria-label="Zoom out"
        data-testid="zoom-out-btn"
      >
        <Minus className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
      </ControlButton>

      {/* Divider */}
      <div className="h-px bg-gray-300 my-1" aria-hidden="true" />

      {/* Locate Button */}
      <ControlButton
        onClick={onLocate}
        disabled={!map}
        aria-label="Center on your location"
        data-testid="locate-btn"
      >
        <Crosshair className="w-5 h-5 text-gray-700" strokeWidth={2} />
      </ControlButton>

      {/* Layer Toggle Button */}
      <ControlButton
        onClick={onLayerToggle}
        disabled={!map}
        aria-label={`Switch to ${layerType === 'standard' ? 'satellite' : 'standard'} view`}
        data-testid="layer-toggle-btn"
      >
        <Layers className="w-5 h-5 text-gray-700" strokeWidth={2} />
      </ControlButton>
    </div>
  )
}
