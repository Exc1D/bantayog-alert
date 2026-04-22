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

import { MyReportLayer } from './MyReportLayer.js'
import type { MyReport } from './types.js'

const map = {} as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MyReportLayer', () => {
  it('adds a pulsing ring for verified reports', async () => {
    const reports: MyReport[] = [
      {
        publicRef: 'abcd1234',
        reportType: 'flood',
        severity: 'high',
        lat: 14.1,
        lng: 122.9,
        submittedAt: 1000,
        status: 'verified',
      },
    ]

    render(<MyReportLayer map={map} reports={reports} onPinTap={vi.fn()} />)

    await waitFor(() => {
      expect(mockDivIcon).toHaveBeenCalled()
    })
    const iconInput = mockDivIcon.mock.calls[0]?.[0] as { html?: string } | undefined
    expect(String(iconInput?.html)).toContain('animation:ringPulse')
    expect(mockLayer.clearLayers).toHaveBeenCalledOnce()
    expect(mockMarker).toHaveBeenCalledOnce()
  })

  it('shows the queued badge for queued reports', async () => {
    render(
      <MyReportLayer
        map={map}
        reports={[
          {
            publicRef: 'q1',
            reportType: 'fire',
            severity: 'medium',
            lat: 14.2,
            lng: 122.8,
            submittedAt: 1000,
            status: 'queued',
          },
        ]}
        onPinTap={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockDivIcon).toHaveBeenCalled()
    })
    const iconInput = mockDivIcon.mock.calls[0]?.[0] as { html?: string } | undefined
    expect(String(iconInput?.html)).toContain('⏳')
  })

  it('skips reports with invalid coordinates', async () => {
    render(
      <MyReportLayer
        map={map}
        reports={[
          {
            publicRef: 'q1',
            reportType: 'fire',
            severity: 'medium',
            lat: Number.NaN,
            lng: 122.8,
            submittedAt: 1000,
            status: 'queued',
          },
        ]}
        onPinTap={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockLayer.clearLayers).toHaveBeenCalledOnce()
    })
    expect(mockMarker).not.toHaveBeenCalled()
  })
})
