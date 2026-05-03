import 'leaflet/dist/leaflet.css'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { AppShell } from '@/components/layout/AppShell'
import {
  IncidentMarker,
  ResponderMarker,
  ResourceMarker,
  HeatmapCircle,
} from '@/components/map/MapMarker'
import { MapControls } from '@/components/map/MapControls'
import { MapLegend } from '@/components/map/MapLegend'
import { MapSearch } from '@/components/map/MapSearch'
import { MapLayerToggles } from '@/components/map/MapLayerToggles'
import { MunicipalityLabels } from '@/components/map/MunicipalityLabels'
import { useDataStore } from '@/stores/dataStore'
import { camarinesNorteGeoJSON } from '@/data/camarinesNorteGeoJSON'
import type { User, Responder, DispatchStatus } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Leaflet default icon fix requires accessing internal prototype
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function generateMockResponders(users: User[]): Responder[] {
  const statuses: DispatchStatus[] = ['STANDBY', 'EN_ROUTE', 'ON_SCENE']
  return users
    .filter((u: User) => u.role === 'RESPONDER')
    .map((u: User, i: number) => {
      const baseLat = 14.11
      const baseLng = 122.95
      const offset = (i + 1) * 0.02
      return {
        id: u.id,
        name: u.name,
        agency: u.agency ?? 'Unknown',
        status: statuses[i % 3] ?? 'STANDBY',
        latitude: baseLat + Math.sin(offset * 3) * 0.08,
        longitude: baseLng + Math.cos(offset * 5) * 0.12,
        lastSeenAt: new Date().toISOString(),
      }
    })
}

const mockResources = [
  { id: 'r-1', name: 'BFP Truck Daet', type: 'VEHICLE', latitude: 14.12, longitude: 122.96 },
  { id: 'r-2', name: 'Rescue Boat Vinzons', type: 'VEHICLE', latitude: 14.19, longitude: 122.92 },
  { id: 'r-3', name: 'Generator Set Labo', type: 'EQUIPMENT', latitude: 14.03, longitude: 122.84 },
  { id: 'r-4', name: 'Relief Goods Mercedes', type: 'SUPPLY', latitude: 14.12, longitude: 123.02 },
  {
    id: 'r-5',
    name: 'Ambulance Jose Panganiban',
    type: 'VEHICLE',
    latitude: 14.3,
    longitude: 122.7,
  },
]

function MapEventBridge({ onMapReady }: { onMapReady: (m: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onMapReady(map)
    return () => {
      /* cleanup */
    }
  }, [map, onMapReady])
  return null
}

function getBoundaryStyle() {
  return {
    color: '#94a3b8',
    weight: 1,
    opacity: 0.6,
    fillColor: 'transparent',
    fillOpacity: 0,
  }
}

export default function MapPage() {
  const { incidents, users, municipalities } = useDataStore()

  const [layers, setLayers] = useState({
    incidents: true,
    responders: true,
    resources: false,
    boundaries: true,
    heatmap: false,
    labels: true,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  const responders = useMemo(() => generateMockResponders(users), [users])

  const filteredIncidents = useMemo(() => {
    let result = incidents
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.barangay.toLowerCase().includes(q) ||
          i.municipality.toLowerCase().includes(q),
      )
    }
    if (severityFilter.length > 0) {
      result = result.filter((i) => severityFilter.includes(i.severity))
    }
    if (typeFilter.length > 0) {
      result = result.filter((i) => typeFilter.includes(i.type))
    }
    return result
  }, [incidents, searchQuery, severityFilter, typeFilter])

  const enrichedGeoJSON = useMemo(() => {
    return {
      ...camarinesNorteGeoJSON,
      features: camarinesNorteGeoJSON.features.map((f) => {
        const name = f.properties?.name
        const count = incidents.filter(
          (i) => i.municipality === name && i.status !== 'RESOLVED',
        ).length
        return {
          ...f,
          properties: { ...f.properties, activeCount: count },
        }
      }),
    }
  }, [incidents])

  const handleToggleLayer = useCallback((key: string) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }, [])

  const handleSeverityToggle = useCallback((s: string) => {
    setSeverityFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }, [])

  const handleTypeToggle = useCallback((t: string) => {
    setTypeFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }, [])

  const handleClearFilters = useCallback(() => {
    setSeverityFilter([])
    setTypeFilter([])
    setSearchQuery('')
  }, [])

  const handleMunicipalityClick = useCallback(
    (feature: GeoJSON.Feature) => {
      const name = feature.properties?.name
      if (name) {
        const mun = municipalities.find((m) => m.name === name)
        if (mun && mapInstance) {
          mapInstance.setView([mun.latitude, mun.longitude], 13, { animate: true, duration: 0.5 })
        }
      }
    },
    [municipalities, mapInstance],
  )

  const handleIncidentClick = useCallback(
    (id: string) => {
      setSelectedIncidentId(id)
      const inc = incidents.find((i) => i.id === id)
      if (inc && mapInstance) {
        mapInstance.setView([inc.latitude, inc.longitude], 14, { animate: true, duration: 0.5 })
      }
    },
    [incidents, mapInstance],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedIncidentId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const geoJsonStyle = useCallback(() => getBoundaryStyle(), [])

  return (
    <AppShell>
      <div className="relative w-full" style={{ height: 'calc(100dvh - 56px)', margin: '-24px' }}>
        <MapContainer
          center={[14.12, 122.85]}
          zoom={10}
          minZoom={8}
          maxZoom={16}
          className="w-full h-full"
          style={{ background: '#f0f0f0' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />

          <MapEventBridge onMapReady={setMapInstance} />

          {layers.boundaries && (
            <GeoJSON
              data={enrichedGeoJSON}
              style={geoJsonStyle}
              onEachFeature={(feature, layer) => {
                layer.on({
                  mouseover: (e) => {
                    const l = e.target
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    l.setStyle({
                      fillColor: 'rgba(214, 73, 51, 0.08)',
                      color: '#d64933',
                      weight: 2,
                      fillOpacity: 1,
                    })
                  },

                  mouseout: (e) => {
                    const l = e.target
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    l.setStyle(getBoundaryStyle())
                  },
                  click: () => {
                    handleMunicipalityClick(feature as GeoJSON.Feature)
                  },
                })
              }}
            />
          )}

          {layers.incidents &&
            filteredIncidents.map((incident) => (
              <IncidentMarker
                key={incident.id}
                incident={incident}
                selected={selectedIncidentId === incident.id}
                onClick={handleIncidentClick}
              />
            ))}

          {layers.responders &&
            responders.map((responder) => (
              <ResponderMarker key={responder.id} responder={responder} />
            ))}

          {layers.resources &&
            mockResources.map((resource) => (
              <ResourceMarker key={resource.id} resource={resource} />
            ))}

          {layers.heatmap &&
            filteredIncidents.map((incident) => (
              <HeatmapCircle key={`heat-${incident.id}`} incident={incident} visible={true} />
            ))}

          <MunicipalityLabels visible={layers.labels} />

          <MapControls />
          <MapLegend />
        </MapContainer>

        <MapSearch
          incidents={incidents}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          severityFilter={severityFilter}
          onSeverityToggle={handleSeverityToggle}
          typeFilter={typeFilter}
          onTypeToggle={handleTypeToggle}
          onClearFilters={handleClearFilters}
        />
        <MapLayerToggles layers={layers} onToggle={handleToggleLayer} />

        {filteredIncidents.length === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 border border-border rounded-xl px-8 py-6 text-center shadow-xl pointer-events-auto">
              <p className="text-xl font-semibold text-foreground mb-2">No active incidents</p>
              <p className="text-sm text-muted-foreground">
                All current incidents match your filters or the province is clear.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-4 px-4 py-2 rounded-md bg-accent/10 text-accent text-sm hover:bg-accent/20 transition-colors"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
