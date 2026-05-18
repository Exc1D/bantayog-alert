import { useState } from 'react'
import { MapPin, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { usePublicIncidents } from '../hooks/usePublicIncidents.js'
import { incidentIcon, incidentLabel } from '../utils/incident-meta.js'
import { getSeverityStyle } from '../utils/useSeverityStyle.js'
import type { PublicIncident, Filters } from './MapTab/types.js'

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function FeedCard({ incident, onTap }: { incident: PublicIncident; onTap: () => void }) {
  const icon = incidentIcon(incident.reportType)
  const label = incidentLabel(incident.reportType)
  const severityStyle = getSeverityStyle(incident.severity)

  return (
    <button
      type="button"
      onClick={onTap}
      className="bg-white rounded-xl mx-3 my-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-[calc(100%-1.5rem)] text-left cursor-pointer block border-none"
    >
      {/* Header row */}
      <div className="flex items-start justify-between p-4 pb-2">
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-100 text-lg"
        >
          {icon}
        </span>
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <p className="m-0 font-semibold text-surface-900 text-sm leading-snug">{label}</p>
            <span className="flex-shrink-0 text-xs text-surface-500">
              {timeAgo(incident.submittedAt)}
            </span>
          </div>
          <p className="mt-1 mb-0 text-xs text-surface-500 flex items-center gap-0.5">
            <MapPin size={11} className="inline flex-shrink-0" />
            <span>
              {incident.barangayId ? `${incident.barangayId}, ` : ''}
              {incident.municipalityLabel}
            </span>
          </p>
        </div>
      </div>

      {incident.featuredMediaUrls && incident.featuredMediaUrls.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto">
          {incident.featuredMediaUrls.slice(0, 3).map((url, idx) => (
            <img
              key={String(idx)}
              loading="lazy"
              src={url}
              alt=""
              className="h-[60px] w-[100px] rounded-lg object-cover flex-shrink-0 bg-surface-100"
            />
          ))}
        </div>
      )}

      {/* Footer action row */}
      <div className="border-t border-surface-100 px-4 py-2 flex items-center gap-4">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: severityStyle.bg, color: severityStyle.fg }}
        >
          {severityStyle.label}
        </span>
        <span className="text-xs text-surface-500 capitalize">
          {incident.status.replace(/_/g, ' ')}
        </span>
        <span className="ml-auto text-xs font-medium text-brand-500">Track</span>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl mx-3 my-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-[calc(100%-1.5rem)]">
      <div className="p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-200 motion-safe:animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 w-[55%] bg-surface-200 rounded motion-safe:animate-pulse mb-2" />
          <div className="h-3 w-[40%] bg-surface-200 rounded motion-safe:animate-pulse mb-3" />
          <div className="h-4 w-14 bg-surface-200 rounded-full motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  )
}

const MUNICIPALITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  ...[...CAMARINES_NORTE_MUNICIPALITIES]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((m) => ({ value: m.label, label: m.label })),
]

export function FeedTab() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<Filters>({ municipality: '' })
  const { incidents, loading, error } = usePublicIncidents(filters)

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-surface-50/90 px-4 py-3 flex flex-col border-b border-surface-200">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-surface-900 m-0">Incident Feed</h1>
        </div>
        {/* Municipality filter chips */}
        <div
          role="group"
          aria-label="Filter by municipality"
          className="flex gap-2 overflow-x-auto pb-1 mt-3 no-scrollbar"
        >
          {MUNICIPALITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.municipality === value}
              onClick={() => {
                setFilters({ municipality: value })
              }}
              className={
                filters.municipality === value
                  ? 'bg-surface-900 text-white rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0 border-none cursor-pointer whitespace-nowrap'
                  : 'bg-surface-100 text-surface-600 rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0 border-none cursor-pointer whitespace-nowrap'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="py-3 pb-24">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div
            role="alert"
            className="mx-3 mt-2 p-4 rounded-xl bg-red-100 text-red-800 text-center text-sm"
          >
            <p className="m-0 mb-1 font-bold">Could not load incidents</p>
            <p className="m-0 text-xs">Hindi makuha ang mga ulat. Subukan ulit.</p>
          </div>
        ) : incidents.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center min-h-[50vh] text-surface-500 px-4"
          >
            <span className="text-surface-400 mb-3">
              <Info size={40} />
            </span>
            <p className="m-0 mb-1 font-bold text-surface-900 text-[15px]">No incidents</p>
            <p className="m-0 text-[13px] text-surface-600 text-center">
              No incidents reported in the selected time window.
              <span className="block text-xs text-surface-500 mt-1 italic">
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
