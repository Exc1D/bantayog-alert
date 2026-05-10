import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { IncidentLayer } from './IncidentLayer'
import type { Report } from '../types'

interface Props {
  reports: Report[]
  selectedReportId: string | null
  onPinClick: (reportId: string) => void
}

const CENTER: [number, number] = [14.1, 122.9]
const ZOOM = 10

export function ProvincialMap({ reports, selectedReportId, onPinClick }: Props) {
  return (
    <div className="h-full w-full">
      <MapContainer center={CENTER} zoom={ZOOM} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <IncidentLayer
          reports={reports}
          selectedReportId={selectedReportId}
          onPinClick={onPinClick}
        />
      </MapContainer>
    </div>
  )
}
