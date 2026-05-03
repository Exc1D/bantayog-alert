import { useMemo } from 'react'
import { renderToString } from 'react-dom/server'
import { Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import type { Report, Responder } from '@/types'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { Waves, Flame, Mountain, Car, HeartPulse, AlertTriangle } from 'lucide-react'

const typeIconMap: Record<string, React.ReactNode> = {
  FLOOD: <Waves className="w-4 h-4" />,
  FIRE: <Flame className="w-4 h-4" />,
  LANDSLIDE: <Mountain className="w-4 h-4" />,
  ACCIDENT: <Car className="w-4 h-4" />,
  MEDICAL: <HeartPulse className="w-4 h-4" />,
  OTHER: <AlertTriangle className="w-4 h-4" />,
}

const severityColors = {
  HIGH: '#dc2626',
  MEDIUM: '#d97706',
  LOW: '#16a34a',
}

function makeIncidentPin(severity: string, type: string) {
  const color = severityColors[severity as keyof typeof severityColors]
  const iconSvg = renderToString(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      {typeIconMap[type] ?? <AlertTriangle className="w-4 h-4" />}
    </div>,
  )
  const pinHtml = `
    <div style="
      width:28px;height:36px;position:relative;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    ">
      <svg viewBox="0 0 28 36" width="28" height="36" style="position:absolute;top:0;left:0;">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="8" fill="#FFFFFF" opacity="0.9"/>
      </svg>
      <div style="position:absolute;top:6px;left:0;width:28px;height:16px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        ${iconSvg}
      </div>
    </div>
  `
  return L.divIcon({
    html: pinHtml,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

function makeResponderPin(status: string) {
  const pulse = status === 'STANDBY' ? 'animation:pulse-ring 2s ease-out infinite;' : ''
  const dash =
    status === 'EN_ROUTE'
      ? 'stroke-dasharray:3,3;animation:spin 3s linear infinite;transform-origin:center;'
      : ''
  const html = `
    <div style="position:relative;width:16px;height:16px;">
      <div style="
        width:16px;height:16px;border-radius:50%;
        background:#d64933;border:2px solid #ffffff;
        ${pulse}
      "></div>
      ${status === 'EN_ROUTE' ? `<svg width="20" height="20" viewBox="0 0 20 20" style="position:absolute;top:-2px;left:-2px;${dash}"><circle cx="10" cy="10" r="9" fill="none" stroke="#d64933" stroke-width="1.5"/></svg>` : ''}
    </div>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function makeResourcePin(type: string) {
  const colors: Record<string, string> = {
    VEHICLE: '#3b82f6',
    EQUIPMENT: '#94a3b8',
    SUPPLY: '#16a34a',
  }
  const color = colors[type] ?? '#94a3b8'
  const html = `
    <div style="
      width:20px;height:20px;border-radius:4px;
      background:${color};border:2px solid #ffffff;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 4px rgba(0,0,0,0.2);
    ">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${type === 'VEHICLE' ? '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l2 3v5h-6V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' : type === 'SUPPLY' ? '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>' : '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'}
      </svg>
    </div>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

interface IncidentMarkerProps {
  incident: Report
  selected: boolean
  onClick: (id: string) => void
}

export function IncidentMarker({ incident, selected, onClick }: IncidentMarkerProps) {
  const icon = useMemo(
    () => makeIncidentPin(incident.severity, incident.type),
    [incident.severity, incident.type],
  )
  return (
    <Marker
      position={[incident.latitude, incident.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => {
          onClick(incident.id)
        },
      }}
    >
      <Popup>
        <div className="min-w-[220px] bg-white border border-border rounded-lg p-3 shadow-lg">
          <div className="text-sm font-mono text-accent font-medium mb-1">#{incident.id}</div>
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={incident.severity} />
          </div>
          <div className="text-xs text-muted-foreground mb-1">{incident.type}</div>
          <div className="text-xs text-muted-foreground">
            {incident.barangay}, {incident.municipality}
          </div>
          <div className="mt-2">
            <StatusBadge status={incident.status} />
          </div>
        </div>
      </Popup>
      {selected && (
        <Circle
          center={[incident.latitude, incident.longitude]}
          radius={200}
          pathOptions={{
            color: severityColors[incident.severity],
            fillColor: severityColors[incident.severity],
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '4,4',
          }}
        />
      )}
    </Marker>
  )
}

interface ResponderMarkerProps {
  responder: Responder
  onClick?: (id: string) => void
}

export function ResponderMarker({ responder, onClick }: ResponderMarkerProps) {
  const icon = useMemo(() => makeResponderPin(responder.status), [responder.status])
  if (!responder.latitude || !responder.longitude) return null
  return (
    <Marker
      position={[responder.latitude, responder.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => {
          onClick?.(responder.id)
        },
      }}
    >
      <Popup>
        <div className="bg-white border border-border rounded-lg p-3 shadow-lg">
          <div className="text-sm text-foreground font-medium">{responder.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{responder.agency}</div>
          <div className="mt-2">
            <StatusBadge status={responder.status} />
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

interface ResourceMarkerProps {
  resource: { id: string; name: string; type: string; latitude: number; longitude: number }
  onClick?: (id: string) => void
}

export function ResourceMarker({ resource, onClick }: ResourceMarkerProps) {
  const icon = useMemo(() => makeResourcePin(resource.type), [resource.type])
  return (
    <Marker
      position={[resource.latitude, resource.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => {
          onClick?.(resource.id)
        },
      }}
    >
      <Popup>
        <div className="bg-white border border-border rounded-lg p-3 shadow-lg">
          <div className="text-sm text-foreground font-medium">{resource.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{resource.type}</div>
        </div>
      </Popup>
    </Marker>
  )
}

interface HeatmapCircleProps {
  incident: Report
  visible: boolean
}

export function HeatmapCircle({ incident, visible }: HeatmapCircleProps) {
  if (!visible) return null
  const colors: Record<string, string> = {
    HIGH: 'rgba(220, 38, 38, 0.35)',
    MEDIUM: 'rgba(59, 130, 246, 0.30)',
    LOW: 'rgba(147, 197, 253, 0.25)',
  }
  const color = colors[incident.severity] ?? colors.LOW
  return (
    <Circle
      center={[incident.latitude, incident.longitude]}
      radius={800}
      pathOptions={{
        color: 'transparent',
        fillColor: color,
        fillOpacity: 0.5,
        weight: 0,
      }}
    />
  )
}
