import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublicIncidents } from '../hooks/usePublicIncidents.js'
import { incidentIcon, incidentLabel } from '../utils/incident-meta.js'
import type { PublicIncident, Filters } from './MapTab/types.js'

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function severityStyle(severity: string): { bg: string; color: string } {
  if (severity === 'high') return { bg: '#fee2e2', color: '#991b1b' }
  if (severity === 'medium') return { bg: '#fff5ef', color: '#a73400' }
  return { bg: '#e0e7f0', color: '#001e40' }
}

function FeedCard({ incident, onTap }: { incident: PublicIncident; onTap: () => void }) {
  const { bg, color } = severityStyle(incident.severity)
  const icon = incidentIcon(incident.reportType)
  const label = incidentLabel(incident.reportType)

  return (
    <button
      type="button"
      onClick={onTap}
      className="card"
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        display: 'block',
        padding: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{ flexShrink: 0, lineHeight: 1.3, display: 'flex', alignItems: 'center' }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#001e40' }}>
              {label}
            </p>
            <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: '#7b8794' }}>
              {timeAgo(incident.submittedAt)}
            </span>
          </div>
          <p style={{ margin: '3px 0 8px', fontSize: '0.8125rem', color: '#52606d' }}>
            📍 {incident.barangayId ? `${incident.barangayId}, ` : ''}
            {incident.municipalityLabel}
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: bg,
                color,
              }}
            >
              {incident.severity.toUpperCase()}
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#7b8794', textTransform: 'capitalize' }}>
              {incident.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div
      className="card"
      style={{ animation: 'pulse 1.6s ease-in-out infinite', marginBottom: '0.5rem' }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#e0e3e5',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 14,
              width: '55%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 12,
              width: '40%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 10,
            }}
          />
          <div style={{ height: 18, width: 52, background: '#e0e3e5', borderRadius: 999 }} />
        </div>
      </div>
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    border: 'none',
    borderRadius: 999,
    background: active ? '#001e40' : '#f2f4f6',
    color: active ? 'white' : '#0f172a',
    padding: '8px 12px',
    fontSize: '0.75rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  }
}

const SEVERITIES: { value: Filters['severity']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const WINDOWS: { value: Filters['window']; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

export function FeedTab() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<Filters>({ severity: 'all', window: '24h' })
  const { incidents, loading, error } = usePublicIncidents(filters)

  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {/* Sticky header + filter chips */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(247,249,251,0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '12px 16px 10px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h1 style={{ margin: '0 0 10px', fontSize: '1.125rem', fontWeight: 800, color: '#001e40' }}>
          Incident Feed
          <span
            style={{
              display: 'block',
              fontSize: '0.6875rem',
              fontWeight: 400,
              color: '#7b8794',
              marginTop: 2,
            }}
          >
            Ulat ng mga insidente sa inyong lugar
          </span>
        </h1>
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          {SEVERITIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.severity === value}
              onClick={() => {
                setFilters((f) => ({ ...f, severity: value }))
              }}
              style={chipStyle(filters.severity === value)}
            >
              {label}
            </button>
          ))}
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 1,
              background: '#e5e7eb',
              margin: '4px 2px',
              alignSelf: 'stretch',
            }}
          />
          {WINDOWS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.window === value}
              onClick={() => {
                setFilters((f) => ({ ...f, window: value }))
              }}
              style={chipStyle(filters.window === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px 24px' }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div
            role="alert"
            style={{
              padding: '16px',
              borderRadius: 12,
              background: '#fee2e2',
              color: '#991b1b',
              textAlign: 'center',
              fontSize: '0.875rem',
            }}
          >
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Could not load incidents</p>
            <p style={{ margin: 0, fontSize: '0.75rem' }}>
              Hindi makuha ang mga ulat. Subukan ulit.
            </p>
          </div>
        ) : incidents.length === 0 ? (
          <div role="status" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>🌿</p>
            <p
              style={{
                margin: '0 0 6px',
                fontWeight: 700,
                color: '#001e40',
                fontSize: '0.9375rem',
              }}
            >
              All clear
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#52606d' }}>
              No incidents reported in the selected time window.
              <span
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  color: '#7b8794',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                Walang naiulat na insidente sa panahong ito.
              </span>
            </p>
          </div>
        ) : (
          incidents.map((incident) => (
            <FeedCard
              key={incident.id}
              incident={incident}
              onTap={() => {
                void navigate(`/incidents/${incident.id}`)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
