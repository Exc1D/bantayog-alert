import { useState } from 'react'
import { CheckCircle, MapPin } from 'lucide-react'
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

function severityBadgeClass(severity: string): string {
  if (severity === 'high')
    return 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800'
  if (severity === 'medium')
    return 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-800'
  if (severity === 'low')
    return 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 text-surface-700'
  return 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-900'
}

function FeedCard({ incident, onTap }: { incident: PublicIncident; onTap: () => void }) {
  const icon = incidentIcon(incident.reportType)
  const label = incidentLabel(incident.reportType)

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
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#f0f4f4] text-lg"
        >
          {icon}
        </span>
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <p className="m-0 font-semibold text-[#25292a] text-sm leading-snug">{label}</p>
            <span className="flex-shrink-0 text-[10px] text-[#768081]">
              {timeAgo(incident.submittedAt)}
            </span>
          </div>
          <p className="mt-1 mb-0 text-xs text-[#768081] flex items-center gap-0.5">
            <MapPin size={11} className="inline flex-shrink-0" />
            <span>
              {incident.barangayId ? `${incident.barangayId}, ` : ''}
              {incident.municipalityLabel}
            </span>
          </p>
        </div>
      </div>
      {/* Footer action row */}
      <div className="border-t border-[#f0f4f4] px-4 py-2 flex items-center gap-4">
        <span className={severityBadgeClass(incident.severity)}>
          {incident.severity.toUpperCase()}
        </span>
        <span className="text-xs text-[#768081] capitalize">
          {incident.status.replace(/_/g, ' ')}
        </span>
        <span className="ml-auto text-xs font-medium text-[#0f9488]">Track</span>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl mx-3 my-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-[calc(100%-1.5rem)]">
      <div className="p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-[#d5dedd] animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 w-[55%] bg-[#d5dedd] rounded animate-pulse mb-2" />
          <div className="h-3 w-[40%] bg-[#d5dedd] rounded animate-pulse mb-3" />
          <div className="h-4 w-14 bg-[#d5dedd] rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
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
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-[#f8fafa]/90 backdrop-blur-md px-4 py-3 flex flex-col border-b border-[#d5dedd]">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-[#25292a] m-0">Incident Feed</h1>
        </div>
        {/* Filter chips row */}
        <div className="flex gap-2 overflow-x-auto pb-1 mt-3 no-scrollbar">
          {SEVERITIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.severity === value}
              onClick={() => {
                setFilters((f) => ({ ...f, severity: value }))
              }}
              className={
                filters.severity === value
                  ? 'bg-[#0f9488] text-white rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0 border-none cursor-pointer'
                  : 'bg-[#f0f4f4] text-[#5e6667] rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0 border-none cursor-pointer'
              }
            >
              {label}
            </button>
          ))}
          <span
            aria-hidden="true"
            className="flex-shrink-0 w-px bg-[#d5dedd] self-stretch mx-0.5"
          />
          {WINDOWS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.window === value}
              onClick={() => {
                setFilters((f) => ({ ...f, window: value }))
              }}
              className={
                filters.window === value
                  ? 'bg-[#0f9488] text-white rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0 border-none cursor-pointer'
                  : 'bg-[#f0f4f4] text-[#5e6667] rounded-full px-3 py-1.5 text-xs font-medium flex-shrink-0 border-none cursor-pointer'
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
            className="flex flex-col items-center justify-center min-h-[50vh] text-[#768081] px-4"
          >
            <span className="text-green-600 mb-3">
              <CheckCircle size={40} />
            </span>
            <p className="m-0 mb-1 font-bold text-[#25292a] text-[15px]">All clear</p>
            <p className="m-0 text-[13px] text-[#52606d] text-center">
              No incidents reported in the selected time window.
              <span className="block text-[11px] text-[#768081] mt-1 italic">
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
