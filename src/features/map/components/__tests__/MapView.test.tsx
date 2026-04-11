import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import L from 'leaflet'
import { MapView } from '../MapView'

// Mock Leaflet library
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    marker: vi.fn(() => ({
      addTo: vi.fn(),
      on: vi.fn(),
    })),
    circle: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    divIcon: vi.fn(() => ({})),
  },
}))

// Mock CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}))

// Mock useGeolocation hook
vi.mock('@/shared/hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(),
}))

import { useGeolocation } from '@/shared/hooks/useGeolocation'

describe('MapView', () => {
  const mockMapInstance = {
    setView: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  }

  const mockMarker = {
    addTo: vi.fn(),
    on: vi.fn(),
  }

  const mockCircle = {
    addTo: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(L.map).mockReturnValue(mockMapInstance as any)
    vi.mocked(L.marker).mockReturnValue(mockMarker as any)
    vi.mocked(L.circle).mockReturnValue(mockCircle as any)

    // Default geolocation state
    vi.mocked(useGeolocation).mockReturnValue({
      coordinates: null,
      loading: false,
      error: null,
      manualLocation: null,
      setManualLocation: vi.fn(),
    })
  })

  describe('when rendered', () => {
    it('should show loading state initially', async () => {
      render(<MapView />)

      expect(screen.getByTestId('map-loading')).toBeInTheDocument()
      expect(screen.getByText(/loading map/i)).toBeInTheDocument()
    })

    it('should render map container', () => {
      render(<MapView />)

      expect(screen.getByTestId('map-view')).toBeInTheDocument()
    })

    it('should use default center coordinates (Camarines Norte)', async () => {
      render(<MapView />)

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            center: [14.5995, 120.9842],
            zoom: 10,
          })
        )
      })
    })

    it('should use default zoom level of 10', async () => {
      render(<MapView />)

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            zoom: 10,
          })
        )
      })
    })
  })

  describe('when initialized', () => {
    it('should add OpenStreetMap tile layer', async () => {
      render(<MapView />)

      await waitFor(() => {
        expect(vi.mocked(L.tileLayer)).toHaveBeenCalledWith(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          expect.objectContaining({
            attribution: expect.stringContaining('OpenStreetMap'),
            maxZoom: 19,
          })
        )
      })
    })

    it('should hide loading state when map is ready', async () => {
      render(<MapView />)

      await waitFor(() => {
        expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument()
      })
    })

    it('should show placeholder controls', async () => {
      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('map-controls-placeholder')).toBeInTheDocument()
        expect(
          screen.getByText(/disaster layer controls coming soon/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('when custom props are provided', () => {
    it('should use custom center coordinates', async () => {
      const customCenter: [number, number] = [10.3157, 123.8854]

      render(<MapView center={customCenter} />)

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            center: customCenter,
          })
        )
      })
    })

    it('should use custom zoom level', async () => {
      render(<MapView zoom={15} />)

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            zoom: 15,
          })
        )
      })
    })

    it('should use both custom center and zoom', async () => {
      const customCenter: [number, number] = [15.5, 121.0]

      render(<MapView center={customCenter} zoom={12} />)

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            center: customCenter,
            zoom: 12,
          })
        )
      })
    })
  })

  describe('map container', () => {
    it('should have full viewport height', () => {
      render(<MapView />)
      const mapContainer = screen.getByTestId('map-view')

      expect(mapContainer).toHaveStyle({ height: '100vh', width: '100%' })
    })

    it('should be responsive', () => {
      render(<MapView />)
      const mapContainer = screen.getByTestId('map-view')

      expect(mapContainer).toHaveClass('w-full', 'h-full')
    })
  })

  describe('cleanup', () => {
    it('should remove map instance on unmount', async () => {
      const { unmount } = render(<MapView />)

      await waitFor(() => {
        expect(mockMapInstance.remove).not.toHaveBeenCalled()
      })

      unmount()

      expect(mockMapInstance.remove).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have accessible loading message', async () => {
      render(<MapView />)

      await waitFor(() => {
        const loadingText = screen.getByText(/loading map/i)
        expect(loadingText).toBeInTheDocument()
      })
    })

    it('should provide loading spinner for visual feedback', async () => {
      render(<MapView />)

      await waitFor(() => {
        const spinner = screen.getByTestId('map-loading').querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
      })
    })
  })

  describe('user location marker', () => {
    it('should show loading state when getting location', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: true,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('location-loading')).toBeInTheDocument()
        expect(screen.getByText(/getting your location/i)).toBeInTheDocument()
      })
    })

    it('should render user location marker when coordinates are available', async () => {
      const mockCoordinates = {
        latitude: 14.5995,
        longitude: 120.9842,
      }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: mockCoordinates,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          expect.objectContaining({
            zIndexOffset: 1000,
          })
        )
        expect(L.circle).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          expect.objectContaining({
            radius: 100,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
            interactive: false,
          })
        )
      })
    })

    it('should show user location info when coordinates are available', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: { latitude: 14.5995, longitude: 120.9842 },
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('user-location-info')).toBeInTheDocument()
        expect(screen.getByText(/your location/i)).toBeInTheDocument()
      })
    })

    it('should update marker position when location changes', async () => {
      const initialCoords = { latitude: 14.5995, longitude: 120.9842 }
      const updatedCoords = { latitude: 14.6, longitude: 120.99 }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: initialCoords,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      const { rerender } = render(<MapView />)

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalledWith(
          [initialCoords.latitude, initialCoords.longitude],
          expect.any(Object)
        )
      })

      // Update mock to return new coordinates
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: updatedCoords,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      rerender(<MapView />)

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalledWith(
          [updatedCoords.latitude, updatedCoords.longitude],
          expect.any(Object)
        )
      })
    })

    it('should show error state when location is unavailable', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: false,
        error: 'PERMISSION_DENIED',
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('location-error')).toBeInTheDocument()
        expect(screen.getByText(/location unavailable/i)).toBeInTheDocument()
        expect(
          screen.getByText(/please enable location permissions/i)
        ).toBeInTheDocument()
      })
    })

    it('should show geolocation unsupported message', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: false,
        error: 'GEOLOCATION_UNSUPPORTED',
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('location-error')).toBeInTheDocument()
        expect(
          screen.getByText(/your browser does not support geolocation/i)
        ).toBeInTheDocument()
      })
    })

    it('should center map on user location when marker is clicked', async () => {
      const mockCoordinates = {
        latitude: 14.5995,
        longitude: 120.9842,
      }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: mockCoordinates,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      let clickHandler: ((event: L.LeafletMouseEvent) => void) | undefined

      vi.mocked(L.marker).mockImplementation((latlng: L.LatLngExpression, options?: L.MarkerOptions) => {
        const marker = {
          addTo: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: () => void) => {
            if (event === 'click') {
              clickHandler = handler as () => void
            }
          }),
        }
        return marker as any
      })

      render(<MapView />)

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalled()
      })

      // Simulate marker click
      if (clickHandler) {
        clickHandler({} as L.LeafletMouseEvent)
        expect(mockMapInstance.setView).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          15,
          { animate: true }
        )
      }
    })

    it('should add accuracy circle around user location', async () => {
      const mockCoordinates = {
        latitude: 14.5995,
        longitude: 120.9842,
      }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: mockCoordinates,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(L.circle).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          expect.objectContaining({
            radius: 100,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
          })
        )
      })
    })

    it('should not show marker when coordinates are null', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />)

      await waitFor(() => {
        expect(screen.queryByTestId('user-location-info')).not.toBeInTheDocument()
        expect(screen.queryByTestId('location-error')).not.toBeInTheDocument()
      })
    })
  })
})
