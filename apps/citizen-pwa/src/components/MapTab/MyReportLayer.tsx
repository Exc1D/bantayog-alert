import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { MyReport } from './types.js'

interface Props {
  map: LeafletMap | null
  reports: MyReport[]
  onPinTap: (report: MyReport) => void
}

const COLORS = { high: '#dc2626', medium: '#a73400', low: '#001e40' } as const

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function makeIcon(color: string, queued: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div style="position:relative;width:44px;height:44px;display:grid;place-items:center;">
        <div style="width:18px;height:18px;border-radius:50%;border:3px solid ${color};background:transparent;${queued ? '' : 'animation:ringPulse 2s ease-in-out infinite;'}"></div>
        ${
          queued
            ? '<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:10px;white-space:nowrap;">⏳</div>'
            : ''
        }
      </div>
      <style>
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.55; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      </style>`,
  })
}

export function MyReportLayer({ map, reports, onPinTap }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!map) return
    layerRef.current ??= L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()

    for (const report of reports) {
      const lat = report.lat
      const lng = report.lng
      if (!isValidCoordinate(lat, lng)) {
        console.warn(
          'Skipping report with invalid coordinates',
          report.publicRef,
          report.lat,
          report.lng,
        )
        continue
      }
      const marker = L.marker([lat, lng], {
        icon: makeIcon(COLORS[report.severity], report.status === 'queued'),
      })
      marker.on('click', () => {
        onPinTap(report)
      })
      layer.addLayer(marker)
    }

    return () => {
      layerRef.current?.clearLayers()
    }
  }, [map, reports, onPinTap])

  return null
}
