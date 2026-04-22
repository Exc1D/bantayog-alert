import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { PublicIncident } from './types.js'

interface Props {
  map: LeafletMap | null
  incidents: PublicIncident[]
  suppressedIds: Set<string>
  onPinTap: (incident: PublicIncident) => void
}

const COLORS = { high: '#dc2626', medium: '#a73400', low: '#001e40' } as const

function makeIcon(color: string, pulse: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div style="position:relative;width:44px;height:44px;display:grid;place-items:center;">
        ${
          pulse
            ? `<div style="position:absolute;width:18px;height:18px;border-radius:50%;background:${color};opacity:0.24;animation:ripple 2s cubic-bezier(0.4,0,0.6,1) infinite;"></div>`
            : ''
        }
        <div style="width:16px;height:16px;border-radius:50%;background:${color};box-shadow:0 0 0 6px color-mix(in srgb, ${color} 18%, transparent);"></div>
      </div>
      <style>
        @keyframes ripple {
          0% { transform: scale(0.85); opacity: 0.28; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      </style>`,
  })
}

export function IncidentLayer({ map, incidents, suppressedIds, onPinTap }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!map) return
    layerRef.current ??= L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()

    for (const incident of incidents) {
      if (suppressedIds.has(incident.id)) continue
      const marker = L.marker([incident.publicLocation.lat, incident.publicLocation.lng], {
        icon: makeIcon(COLORS[incident.severity], incident.severity === 'high'),
      })
      marker.on('click', () => {
        onPinTap(incident)
      })
      layer.addLayer(marker)
    }

    return () => {
      layerRef.current?.clearLayers()
    }
  }, [map, incidents, suppressedIds, onPinTap])

  return null
}
