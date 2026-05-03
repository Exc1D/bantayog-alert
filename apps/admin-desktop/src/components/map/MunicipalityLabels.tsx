import { useEffect, useMemo } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useDataStore } from '@/stores/dataStore'
import { camarinesNorteGeoJSON } from '@/data/camarinesNorteGeoJSON'

interface MunicipalityLabelsProps {
  visible: boolean
}

export function MunicipalityLabels({ visible }: MunicipalityLabelsProps) {
  const map = useMap()
  const { incidents } = useDataStore()

  const labels = useMemo(() => {
    return camarinesNorteGeoJSON.features.map((f) => {
      const name = String(f.properties?.name ?? '')
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0]
      if (!coords) return { name, lat: 0, lng: 0, count: 0 }
      let latSum = 0,
        lngSum = 0
      coords.forEach((c) => {
        lngSum += c[0] ?? 0
        latSum += c[1] ?? 0
      })
      const count = incidents.filter(
        (i) => i.municipality === name && i.status !== 'RESOLVED',
      ).length
      return {
        name,
        lat: latSum / coords.length,
        lng: lngSum / coords.length,
        count,
      }
    })
  }, [incidents])

  useEffect(() => {
    if (!visible) return
    const markers: L.Marker[] = []
    labels.forEach((label) => {
      const icon = L.divIcon({
        html: `<div style="text-align:center;pointer-events:none;">
          <div style="font-size:11px;font-weight:600;color:#1f2937;text-shadow:0 1px 2px rgba(255,255,255,0.8);white-space:nowrap;">${label.name}</div>
          ${label.count > 0 ? `<div style="font-size:10px;font-weight:700;color:#dc2626;margin-top:2px;">${String(label.count)}</div>` : ''}
        </div>`,
        className: '',
        iconSize: [80, 30],
        iconAnchor: [40, 15],
      })
      const marker = L.marker([label.lat, label.lng], {
        icon,
        interactive: false,
        zIndexOffset: -1000,
      }).addTo(map)
      markers.push(marker)
    })
    return () => {
      markers.forEach((m) => {
        map.removeLayer(m)
      })
    }
  }, [visible, labels, map])

  return null
}
