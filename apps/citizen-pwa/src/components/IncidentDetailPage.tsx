import { type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Waves,
  Flame,
  AlertTriangle,
  CloudLightning,
  Mountain,
  Truck,
  Car,
  Building2,
  Siren,
  SearchX,
  Zap,
} from 'lucide-react'
import { useIncident } from '../hooks/useIncident.js'
import { getSeverityStyle } from '../utils/useSeverityStyle.js'

const INCIDENT_LABELS: Record<string, string> = {
  flood: 'Flood',
  fire: 'Fire',
  earthquake: 'Earthquake',
  typhoon: 'Typhoon',
  landslide: 'Landslide',
  storm_surge: 'Storm Surge',
  medical: 'Medical',
  accident: 'Accident',
  structural: 'Structural',
  security: 'Security',
  other: 'Other',
}

const INCIDENT_ICONS: Record<string, ReactNode> = {
  flood: <Waves size={36} className="text-blue-600" />,
  fire: <Flame size={36} className="text-orange-600" />,
  earthquake: <AlertTriangle size={36} className="text-yellow-600" />,
  typhoon: <CloudLightning size={36} className="text-slate-600" />,
  landslide: <Mountain size={36} className="text-amber-700" />,
  storm_surge: <Waves size={36} className="text-cyan-600" />,
  medical: <Truck size={36} className="text-red-600" />,
  accident: <Car size={36} className="text-slate-600" />,
  structural: <Building2 size={36} className="text-stone-600" />,
  security: <Siren size={36} className="text-red-700" />,
  other: <AlertTriangle size={36} className="text-slate-500" />,
}

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${String(days)} day${days === 1 ? '' : 's'} ago`
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { incident, loading, error } = useIncident(id ?? '')

  return (
    <div className="page-container">
      <div className="page-header">
        <button
          type="button"
          className="back-btn"
          aria-label="Go back"
          onClick={() => {
            void navigate(-1)
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="step-indicator">Incident Details</span>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div className="location-loading-spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.875rem', color: '#7b8794' }}>
            Loading incident...
            <span
              style={{ display: 'block', fontStyle: 'italic', fontSize: '0.75rem', marginTop: 4 }}
            >
              Kinukuha ang ulat...
            </span>
          </p>
        </div>
      ) : error ? (
        <div role="alert" className="card" style={{ background: '#fee2e2', color: '#991b1b' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Could not load incident</p>
          <p style={{ margin: 0, fontSize: '0.75rem' }}>Hindi makuha ang ulat na ito.</p>
        </div>
      ) : !incident ? (
        <div role="status" style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ margin: '0 0 8px' }}>
            <SearchX size={40} className="text-surface-300 mx-auto" />
          </p>
          <p style={{ fontWeight: 700, color: '#001e40', margin: '0 0 6px' }}>Incident not found</p>
          <p style={{ fontSize: '0.8125rem', color: '#52606d', margin: 0 }}>
            This report may have been removed or is no longer public.
          </p>
        </div>
      ) : (
        <>
          {/* Hero card */}
          <div className="card" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ lineHeight: 1, flexShrink: 0 }}>
                {INCIDENT_ICONS[incident.reportType] ?? (
                  <AlertTriangle size={36} className="text-surface-400" />
                )}
              </span>
              <div style={{ flex: 1 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.375rem',
                    fontWeight: 800,
                    color: '#001e40',
                    lineHeight: 1.2,
                  }}
                >
                  {INCIDENT_LABELS[incident.reportType] ?? incident.reportType}
                </h2>
                {(() => {
                  const s = getSeverityStyle(incident.severity)
                  return (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 8,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        background: s.bg,
                        color: s.fg,
                      }}
                    >
                      {s.label}
                    </span>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <div className="card-row">
              <span className="card-label">Location</span>
              <span className="card-value">
                {incident.barangayId ? `${incident.barangayId}, ` : ''}
                {incident.municipalityLabel}
              </span>
            </div>
            <div className="card-row">
              <span className="card-label">Reported</span>
              <span className="card-value">{timeAgo(incident.submittedAt)}</span>
            </div>
            <div className="card-row" style={{ marginBottom: 0 }}>
              <span className="card-label">Status</span>
              <span className="card-value" style={{ textTransform: 'capitalize' }}>
                {incident.status.replace(/_/g, ' ')}
              </span>
            </div>
            {incident.verifiedAt ? (
              <div className="card-row" style={{ marginBottom: 0 }}>
                <span className="card-label">Verified</span>
                <span className="card-value">{timeAgo(incident.verifiedAt)}</span>
              </div>
            ) : null}
          </div>

          {/* CTA */}
          <button
            type="button"
            className="btn btn--secondary btn--full"
            onClick={() => {
              void navigate('/report')
            }}
            style={{ marginTop: '0.5rem' }}
          >
            <Zap size={14} className="inline" aria-hidden="true" /> Report similar incident nearby
          </button>
        </>
      )}
    </div>
  )
}
