import { useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet'
import type { MunicipalityData } from './MunicipalGrid'

export interface Incident {
  id: string
  location: { lat: number; lng: number }
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  municipality: string
}

interface ProvincialMapProps {
  incidents: Incident[]
  municipalities: MunicipalityData[]
  selectedMunicipality: string | null
}

export function ProvincialMap({ incidents, municipalities }: ProvincialMapProps) {
  const provinceBounds: [[number, number], [number, number]] = [
    [13.8, 122.2],
    [14.4, 123.1],
  ]

  // Memoize GeoJSON data to avoid recreating on every render
  const geoJsonData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: municipalities.map((m) => ({
        type: 'Feature' as const,
        properties: {
          name: m.name,
          activeIncidents: m.activeIncidents,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[]],
        },
      })),
    }),
    [municipalities],
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        bounds={provinceBounds}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <GeoJSON
          data={geoJsonData}
          style={(feature: GeoJSON.Feature | undefined) => {
            const name = feature?.properties?.name as string | undefined
            const muni = municipalities.find((m) => m.name === name)
            const count = muni?.activeIncidents ?? 0

            return {
              fillColor:
                count === 0
                  ? '#e9ecef'
                  : count <= 2
                    ? '#fff3cd'
                    : count <= 5
                      ? '#ffe5b4'
                      : '#ffccd5',
              weight: 2,
              opacity: 1,
              color: '#adb5bd',
              fillOpacity: 0.7,
            }
          }}
        />

        {incidents.map((incident) => (
          <Marker key={incident.id} position={[incident.location.lat, incident.location.lng]}>
            <Popup>
              <div>
                <strong>{incident.type}</strong>
                <br />
                {incident.municipality}
                <br />
                Severity: {incident.severity}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Empty State Overlay */}
      {incidents.length === 0 && (
        <div
          data-testid="empty-state-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(248, 249, 250, 0.8)',
            zIndex: 500,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '32px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#2d6a4f',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 16px auto',
              }}
            >
              &#10003;
            </div>
            <h2
              style={{
                fontSize: '28px',
                fontWeight: 600,
                color: '#495057',
                margin: '0 0 8px 0',
              }}
            >
              No active incidents
            </h2>
            <p
              style={{
                fontSize: '18px',
                color: '#6c757d',
                margin: 0,
              }}
            >
              All municipalities reporting normal status
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          fontSize: '14px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '16px' }}>Legend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#a73400',
            }}
          />
          <span>Critical</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#c77600',
            }}
          />
          <span>Medium</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#2d6a4f',
            }}
          />
          <span>Low</span>
        </div>
      </div>
    </div>
  )
}
