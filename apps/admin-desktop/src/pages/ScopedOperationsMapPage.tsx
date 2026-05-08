import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@bantayog/shared-ui'
import type { Report, ReportStatus, ReportType, Severity } from '@/types'
import { callables } from '../services/callables'

const MAP_WIDTH = 1000
const MAP_HEIGHT = 480
const LAT_MIN = 13.95
const LAT_MAX = 14.45
const LNG_MIN = 122.35
const LNG_MAX = 123.15

function mapType(value: unknown): ReportType {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (
    normalized === 'FLOOD' ||
    normalized === 'FIRE' ||
    normalized === 'LANDSLIDE' ||
    normalized === 'ACCIDENT' ||
    normalized === 'MEDICAL'
  ) {
    return normalized
  }
  return 'OTHER'
}

function mapSeverity(value: unknown): Severity {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') {
    return normalized
  }
  return 'LOW'
}

function mapStatus(value: unknown): ReportStatus {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'awaiting_verify' || normalized === 'new') return 'PENDING'
  if (
    normalized === 'verified' ||
    normalized === 'assigned' ||
    normalized === 'acknowledged' ||
    normalized === 'en_route' ||
    normalized === 'on_scene'
  ) {
    return 'ACTIVE'
  }
  if (normalized === 'reopened' || normalized === 'merged_as_duplicate') return 'ESCALATED'
  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'cancelled') {
    return 'RESOLVED'
  }
  return 'CRITICAL'
}

function toIncident(id: string, reportData: Record<string, unknown>): Report | null {
  const location = reportData.publicLocation as { lat?: unknown; lng?: unknown } | undefined
  const lat = typeof location?.lat === 'number' ? location.lat : null
  const lng = typeof location?.lng === 'number' ? location.lng : null
  if (lat === null || lng === null) return null

  const submittedAt =
    typeof reportData.submittedAt === 'number' ? reportData.submittedAt : Date.now()
  return {
    id,
    type: mapType(reportData.reportType),
    severity: mapSeverity(reportData.severity),
    status: mapStatus(reportData.status),
    municipality:
      typeof reportData.municipalityLabel === 'string'
        ? reportData.municipalityLabel
        : typeof reportData.municipalityId === 'string'
          ? reportData.municipalityId
          : 'Unknown',
    barangay:
      typeof reportData.barangayId === 'string'
        ? reportData.barangayId
        : typeof reportData.barangay === 'string'
          ? reportData.barangay
          : 'Unknown',
    description:
      typeof reportData.description === 'string' ? reportData.description : 'No description',
    reporterName: 'Anonymous',
    reporterPhone: '—',
    latitude: lat,
    longitude: lng,
    createdAt: new Date(submittedAt).toISOString(),
    updatedAt: new Date(
      typeof reportData.updatedAt === 'number' ? reportData.updatedAt : submittedAt,
    ).toISOString(),
    ...(typeof reportData.assignedAgency === 'string'
      ? { assignedAgency: reportData.assignedAgency }
      : {}),
    ...(typeof reportData.activeResponderCount === 'number'
      ? { responderCount: reportData.activeResponderCount }
      : {}),
  }
}

function projectPoint(lat: number, lng: number): { x: number; y: number } {
  const clampedLat = Math.min(Math.max(lat, LAT_MIN), LAT_MAX)
  const clampedLng = Math.min(Math.max(lng, LNG_MIN), LNG_MAX)
  const x = ((clampedLng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_WIDTH
  const y = ((LAT_MAX - clampedLat) / (LAT_MAX - LAT_MIN)) * MAP_HEIGHT
  return { x, y }
}

function incidentFill(severity: Severity): string {
  if (severity === 'HIGH') return '#dc2626'
  if (severity === 'MEDIUM') return '#d97706'
  return '#16a34a'
}

async function loadScopedIncidents(role: string): Promise<Report[]> {
  if (role !== 'municipal_admin' && role !== 'agency_admin') return []
  const result = await callables.listScopedOperationsMap()
  return result.incidents
    .map((incident) => toIncident(incident.reportId, incident.report))
    .filter((incident): incident is Report => incident !== null)
}

export default function ScopedOperationsMapPage() {
  const { claims, loading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : ''
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId.trim() : ''
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId.trim() : ''

  const scopeLabel =
    role === 'municipal_admin'
      ? municipalityId || 'Missing municipality scope'
      : role === 'agency_admin'
        ? agencyId || 'Missing agency scope'
        : 'Province'

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['scoped-operations-map', role, municipalityId, agencyId],
    queryFn: async () => loadScopedIncidents(role),
    refetchInterval: 30_000,
    enabled: !loading,
  })

  if (loading) {
    return (
      <AppShell>
        <main style={{ padding: 24 }}>
          <p>Loading map…</p>
        </main>
      </AppShell>
    )
  }

  if ((role === 'municipal_admin' && !municipalityId) || (role === 'agency_admin' && !agencyId)) {
    return (
      <AppShell>
        <main style={{ padding: 24 }}>
          <div role="alert">Access denied. Missing scope claim for this map.</div>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main style={{ padding: 24, display: 'grid', gap: 16 }}>
        <header
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: '#001e40' }}>Live Map · {scopeLabel}</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
              Scoped to {role === 'agency_admin' ? 'agency' : 'municipality'} active incidents.
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
            {isLoading
              ? 'Refreshing…'
              : `${String(incidents.length)} active incident${incidents.length === 1 ? '' : 's'}`}
          </p>
        </header>

        <section
          aria-label="Scoped live incident map"
          style={{
            border: '1px solid #dfe3e8',
            borderRadius: 12,
            overflow: 'hidden',
            minHeight: 480,
            background: 'linear-gradient(180deg, #e0f2fe 0%, #f8fafc 48%, #eef2ff 100%)',
          }}
        >
          <svg
            role="img"
            aria-label="Scoped incident map"
            viewBox={`0 0 ${String(MAP_WIDTH)} ${String(MAP_HEIGHT)}`}
            width="100%"
            height="480"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waterFade" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#waterFade)" />
            {Array.from({ length: 5 }).map((_, idx) => (
              <line
                key={idx}
                x1="0"
                y1={String((MAP_HEIGHT / 4) * idx)}
                x2={String(MAP_WIDTH)}
                y2={String((MAP_HEIGHT / 4) * idx)}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 8"
                opacity="0.3"
              />
            ))}
            {Array.from({ length: 6 }).map((_, idx) => (
              <line
                key={`v-${String(idx)}`}
                x1={String((MAP_WIDTH / 5) * idx)}
                y1="0"
                x2={String((MAP_WIDTH / 5) * idx)}
                y2={String(MAP_HEIGHT)}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 8"
                opacity="0.2"
              />
            ))}
            {incidents.map((incident) => {
              const point = projectPoint(incident.latitude, incident.longitude)
              const fill = incidentFill(incident.severity)
              return (
                <g key={incident.id} data-testid={`incident-${incident.id}`}>
                  <circle
                    cx={String(point.x)}
                    cy={String(point.y)}
                    r="12"
                    fill={fill}
                    opacity="0.2"
                  />
                  <circle cx={String(point.x)} cy={String(point.y)} r="6" fill={fill} />
                  <text
                    x={String(point.x + 10)}
                    y={String(point.y - 10)}
                    fill="#0f172a"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {incident.type}
                  </text>
                </g>
              )
            })}
          </svg>
        </section>

        <section aria-labelledby="incident-list-heading">
          <h2 id="incident-list-heading" style={{ margin: '0 0 8px', fontSize: 16 }}>
            Active Incidents
          </h2>
          {incidents.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No active incidents are visible in this scope.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {incidents.map((incident) => (
                <li
                  key={incident.id}
                  style={{
                    border: '1px solid #dfe3e8',
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: '#fff',
                  }}
                >
                  <strong style={{ display: 'block', color: '#111827' }}>{incident.type}</strong>
                  <span style={{ display: 'block', color: '#6b7280', fontSize: 13 }}>
                    {incident.municipality} · {incident.barangay}
                  </span>
                  <span style={{ display: 'block', color: '#374151', fontSize: 13, marginTop: 4 }}>
                    {incident.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  )
}
