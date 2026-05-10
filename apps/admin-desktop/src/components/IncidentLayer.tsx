import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { Waves, Flame, Mountain, Car, HeartPulse, AlertTriangle } from 'lucide-react'
import { renderToString } from 'react-dom/server'
import type { Report } from '../types'
import { SEVERITY_COLORS, type Severity } from '../styles/severity-colors'

const TYPE_ICONS = {
  FLOOD: Waves,
  FIRE: Flame,
  LANDSLIDE: Mountain,
  ACCIDENT: Car,
  MEDICAL: HeartPulse,
  OTHER: AlertTriangle,
}

interface Props {
  reports: Report[]
  selectedReportId: string | null
  onPinClick: (reportId: string) => void
}

function createPinIcon(type: Report['type'], severity: Severity, isSelected: boolean) {
  const Icon = TYPE_ICONS[type]
  const color = SEVERITY_COLORS[severity]
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

export function IncidentLayer({ reports, selectedReportId, onPinClick }: Props) {
  const map = useMap()
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []

    reports.forEach((report) => {
      // Validate coordinates at the boundary — assume external input may be broken
      if (
        typeof report.latitude !== 'number' ||
        typeof report.longitude !== 'number' ||
        !Number.isFinite(report.latitude) ||
        !Number.isFinite(report.longitude) ||
        report.latitude < -90 ||
        report.latitude > 90 ||
        report.longitude < -180 ||
        report.longitude > 180
      ) {
        console.warn(`Invalid coordinates for report ${report.id}:`, {
          lat: report.latitude,
          lng: report.longitude,
        })
        return
      }

      try {
        const marker = L.marker([report.latitude, report.longitude], {
          icon: createPinIcon(report.type, report.severity, report.id === selectedReportId),
        })
        marker.on('click', () => {
          onPinClick(report.id)
        })
        marker.addTo(map)
        markersRef.current.push(marker)
      } catch (error) {
        console.error(`Failed to create marker for report ${report.id}:`, error)
      }
    })

    return () => {
      markersRef.current.forEach((m) => {
        m.off('click')
        map.removeLayer(m)
      })
      markersRef.current = []
    }
  }, [reports, selectedReportId, map, onPinClick])

  return null
}
