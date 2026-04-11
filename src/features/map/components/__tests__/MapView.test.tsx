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
  },
}))

// Mock CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}))

describe('MapView', () => {
  const mockMapInstance = {
    setView: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(L.map).mockReturnValue(mockMapInstance as any)
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
})
