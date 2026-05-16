import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { AlertTriangle } from 'lucide-react'
import { renderToString } from 'react-dom/server'
import { TYPE_ICONS, SEVERITY_COLORS } from '../constants/report'
import type { Report } from '../types'
import type { Severity } from '../stores/commandCenterStore'

function createPinIcon(type: Report['type'], severity: Severity, isSelected: boolean) {
  // Runtime guard: Firestore may contain legacy/unknown type values
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const Icon = TYPE_ICONS[type] ?? AlertTriangle
  // Runtime guard: unknown severity should not produce transparent pins
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const color = SEVERITY_COLORS[severity] ?? 'var(--color-severity-low)'
  const size = isSelected ? 28 : 24
  const html = renderToString(
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '50%',
        border: '2px solid white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isSelected ? `0 0 12px ${color}` : '0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      <Icon
        style={{
          width: size * 0.5,
          height: size * 0.5,
          color: 'white',
        }}
      />
    </div>,
  )
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface Props {
  reports: Report[]
  selectedReportId: string | null
  onPinClick: (reportId: string) => void
}

export function IncidentLayer({ reports, selectedReportId, onPinClick }: Props) {
  const map = useMap()
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []

    reports.forEach((report) => {
      const hasValidCoordinates =
        Number.isFinite(report.latitude) &&
        Number.isFinite(report.longitude) &&
        report.latitude >= -90 &&
        report.latitude <= 90 &&
        report.longitude >= -180 &&
        report.longitude <= 180

      if (!hasValidCoordinates) return

      const marker = L.marker([report.latitude, report.longitude], {
        icon: createPinIcon(report.type, report.severity, report.id === selectedReportId),
      })
      marker.on('click', () => {
        onPinClick(report.id)
      })
      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [reports, selectedReportId, map, onPinClick])

  return null
}
