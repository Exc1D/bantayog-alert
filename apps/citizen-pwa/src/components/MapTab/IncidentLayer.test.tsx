import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { mockDivIcon, mockMarker, mockLayerGroup, mockLayer } = vi.hoisted(() => {
  const mockLayer = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
  }
  return {
    mockDivIcon: vi.fn((input: unknown) => input),
    mockMarker: vi.fn(() => ({ on: vi.fn() })),
    mockLayerGroup: vi.fn(() => mockLayer),
    mockLayer,
  }
})

vi.mock('leaflet', () => ({
  default: {
    divIcon: mockDivIcon,
    marker: mockMarker,
    layerGroup: mockLayerGroup,
  },
  divIcon: mockDivIcon,
  marker: mockMarker,
  layerGroup: mockLayerGroup,
}))

import { IncidentLayer } from './IncidentLayer.js'
import type { PublicIncident } from './types.js'

const map = {} as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IncidentLayer', () => {
  it('adds a ripple for high severity markers', async () => {
    const incidents: PublicIncident[] = [
      {
        id: 'r1',
        reportType: 'flood',
        severity: 'high',
        status: 'verified',
        barangayId: 'brgy-1',
        municipalityLabel: 'Daet',
        publicLocation: { lat: 14.1, lng: 122.9 },
        submittedAt: 1000,
      },
    ]

    render(
      <IncidentLayer
        map={map}
        incidents={incidents}
        suppressedIds={new Set()}
        onPinTap={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockDivIcon).toHaveBeenCalled()
    })
    const iconInput = mockDivIcon.mock.calls[0]?.[0] as { html?: string } | undefined
    expect(String(iconInput?.html)).toContain('animation:ripple')
    expect(mockLayer.clearLayers).toHaveBeenCalledOnce()
    expect(mockMarker).toHaveBeenCalledOnce()
  })

  it('skips incidents with invalid coordinates', async () => {
    const incidents: PublicIncident[] = [
      {
        id: 'r1',
        reportType: 'flood',
        severity: 'high',
        status: 'verified',
        barangayId: 'brgy-1',
        municipalityLabel: 'Daet',
        publicLocation: { lat: Number.POSITIVE_INFINITY, lng: 122.9 },
        submittedAt: 1000,
      },
    ]

    render(
      <IncidentLayer
        map={map}
        incidents={incidents}
        suppressedIds={new Set()}
        onPinTap={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockLayer.clearLayers).toHaveBeenCalledOnce()
    })
    expect(mockMarker).not.toHaveBeenCalled()
  })
})
