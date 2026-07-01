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
import { timeAgoLong as timeAgo } from '../lib/time-ago.js'

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
          <p className="text-sm text-surface-500">
            Loading incident...
            <span className="block italic text-xs mt-1">Kinukuha ang ulat...</span>
          </p>
        </div>
      ) : error ? (
        <div role="alert" className="card bg-danger-100 text-danger-700">
          <p className="mb-1 font-bold">Could not load incident</p>
          <p className="m-0 text-xs">Hindi makuha ang ulat na ito.</p>
        </div>
      ) : !incident ? (
        <div role="status" className="text-center py-12">
          <p className="mb-2">
            <SearchX size={40} className="text-surface-300 mx-auto" />
          </p>
          <p className="font-bold text-surface-900 mb-1.5">Incident not found</p>
          <p className="text-xs text-surface-600 m-0">
            This report may have been removed or is no longer public.
          </p>
        </div>
      ) : (
        <>
          {/* Hero card */}
          <div className="card mb-3 p-4">
            <div className="flex gap-3 items-start">
              <span aria-hidden="true" className="leading-none flex-shrink-0">
                {INCIDENT_ICONS[incident.reportType] ?? (
                  <AlertTriangle size={36} className="text-surface-400" />
                )}
              </span>
              <div className="flex-1">
                <h2 className="m-0 text-[1.375rem] font-extrabold text-surface-900 leading-tight">
                  {INCIDENT_LABELS[incident.reportType] ?? incident.reportType}
                </h2>
                {(() => {
                  const s = getSeverityStyle(incident.severity)
                  return (
                    <span
                      className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                      style={{ background: s.bg, color: s.fg }}
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
            className="btn btn--secondary btn--full mt-2"
            onClick={() => {
              void navigate('/report')
            }}
          >
            <Zap size={14} className="inline" aria-hidden="true" /> Report similar incident nearby
          </button>
        </>
      )}
    </div>
  )
}
