import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { X } from 'lucide-react'
import { actionsFor } from '../../lib/reportActions.js'
import type { MyReport, PublicIncident } from './types.js'

const SEVERITY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: '#fee2e2', color: '#991b1b', label: 'HIGH' },
  medium: { bg: '#fff5ef', color: '#a73400', label: 'MEDIUM' },
  low: { bg: '#e0e7f0', color: '#414849', label: 'LOW' },
}

type Props =
  | {
      mode: 'public'
      incident: PublicIncident
      sheetPhase: 'hidden' | 'peek' | 'expanded'
      onClose: () => void
      onCollapse: () => void
      onReportSimilar?: () => void
    }
  | {
      mode: 'myReport'
      report: MyReport
      sheetPhase: 'hidden' | 'peek' | 'expanded'
      onClose: () => void
      onCollapse: () => void
    }

const LABELS: Record<string, string> = {
  flood: 'Flood',
  fire: 'Fire',
  earthquake: 'Earthquake',
  typhoon: 'Typhoon',
  landslide: 'Landslide',
  storm_surge: 'Storm Surge',
  medical: 'Medical',
  accident: 'Accidents/Rescue',
  structural: 'Damages',
  security: 'Security',
  other: 'Others',
}

const PROGRESS_STATUSES = ['new', 'awaiting_verify', 'verified', 'en_route', 'resolved'] as const

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${String(days)} day${days === 1 ? '' : 's'} ago`
}

function progressStatus(status: MyReport['status']): (typeof PROGRESS_STATUSES)[number] {
  if (status === 'queued' || status === 'draft_inbox' || status === 'new') return 'new'
  if (status === 'awaiting_verify') return 'awaiting_verify'
  if (status === 'verified' || status === 'assigned' || status === 'acknowledged') return 'verified'
  if (status === 'en_route' || status === 'on_scene') return 'en_route'
  return 'resolved'
}

export function DetailSheet(props: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  if (props.sheetPhase === 'hidden') return null

  async function handleCopy(text: string) {
    try {
      if (!('clipboard' in navigator)) {
        throw new Error('Clipboard API is unavailable')
      }

      const clipboard = navigator.clipboard
      await clipboard.writeText(text)
      setCopied(true)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err: unknown) {
      console.error('Failed to copy tracking code', err)
      setCopied(false)
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    startY.current = event.touches[0]?.clientY ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (startY.current === null) return
    const delta = (event.changedTouches[0]?.clientY ?? 0) - startY.current
    startY.current = null
    if (delta > 80) props.onClose()
    else if (delta > 30) props.onCollapse()
  }

  const dragHandle = (
    <div className="flex justify-center pt-2 pb-4">
      <div className="w-8 h-1 rounded-full bg-surface-200" />
    </div>
  )

  if (props.mode === 'public') {
    const incident = props.incident
    const badge = SEVERITY_BADGE[incident.severity]
    return (
      <section
        className="fixed inset-x-0 bottom-0 z-modal bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto px-4 pb-8 pt-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {dragHandle}

        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xl font-extrabold text-surface-900">
              {LABELS[incident.reportType] ?? incident.reportType}
            </p>
            {badge ? (
              <span
                className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold tracking-widest uppercase"
                style={{ backgroundColor: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={props.onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-100 text-surface-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span aria-hidden="true" className="text-sm">
            📍
          </span>
          <p className="text-sm font-medium text-surface-900">
            {incident.barangayId ? `${incident.barangayId}, ` : ''}
            {incident.municipalityLabel}
          </p>
        </div>

        {/* Time */}
        <p className="text-xs text-surface-500 mb-5">Reported {timeAgo(incident.submittedAt)}</p>

        {/* Report similar CTA */}
        {props.onReportSimilar ? (
          <button
            type="button"
            onClick={props.onReportSimilar}
            className="w-full py-3 px-4 rounded-xl border border-surface-200 bg-surface-100 text-surface-900 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span aria-hidden="true">⚡</span>
            Report similar incident nearby
          </button>
        ) : null}
      </section>
    )
  }

  const report = props.report
  const displayStatus = progressStatus(report.status)
  const actions = actionsFor(displayStatus)
  const statusIndex = PROGRESS_STATUSES.indexOf(displayStatus)

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-modal bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto px-4 pb-8 pt-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {dragHandle}
      <p className="font-extrabold text-surface-900">★ Your Report</p>
      <p className="mt-1 mb-4 font-bold text-lg text-surface-900">
        {LABELS[report.reportType] ?? report.reportType}
        {report.status !== 'queued' && report.status !== 'new'
          ? ` · ${report.status.replace(/_/g, ' ')}`
          : ' · Awaiting Review'}
      </p>
      <div className="bg-surface-100 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
        <div>
          <p className="mb-1 text-[0.625rem] font-bold tracking-widest uppercase text-surface-500">
            Tracking Code
          </p>
          <span className="font-extrabold text-surface-900">{report.publicRef}</span>
        </div>
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy'}
          onClick={() => {
            void handleCopy(report.publicRef)
          }}
          className="text-brand-500 text-sm font-medium"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <div className="flex gap-1 mb-5">
        {PROGRESS_STATUSES.map((step, index) => (
          <div
            key={step}
            className={`flex items-center ${index < PROGRESS_STATUSES.length - 1 ? 'flex-1' : ''}`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full border-2"
              style={{
                backgroundColor: index <= statusIndex ? '#0f9488' : '#d5dedd',
                borderColor: '#0f9488',
              }}
            />
            {index < PROGRESS_STATUSES.length - 1 ? (
              <div
                className="flex-1 h-0.5"
                style={{
                  backgroundColor: index < statusIndex ? '#0f9488' : '#d5dedd',
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      {actions.includes('edit') ? (
        <div className="flex gap-2 mb-2">
          <button type="button" aria-label="Edit">
            Edit
          </button>
          <button type="button" aria-label="Cancel report">
            Cancel
          </button>
        </div>
      ) : null}
      {actions.includes('request_correction') ? (
        <button type="button" aria-label="Request correction" className="mb-2">
          Request Correction
        </button>
      ) : null}
      <button type="button" aria-label="Close" onClick={props.onClose}>
        Close
      </button>
    </section>
  )
}
