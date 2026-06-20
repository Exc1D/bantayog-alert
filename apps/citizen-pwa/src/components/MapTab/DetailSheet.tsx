import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { ArrowRight, MapPin, X, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { statusMeta } from '../../utils/incident-meta.js'
import {
  getHazardTypePresentation,
  getOperationalStagePresentation,
} from '../../utils/status-registry.js'
import { buildTrackingTimeline } from '../../utils/tracking-timeline.js'
import { getSeverityStyle } from '../../utils/useSeverityStyle.js'
import type { MyReport, PublicIncident } from './types.js'

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

// This compact peek intentionally mirrors the public detail card's scan order.
// fallow-ignore-next-line code-duplication
function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${String(days)} day${days === 1 ? '' : 's'} ago`
}

// fallow-ignore-next-line code-duplication
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
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable')
      await navigator.clipboard.writeText(text)
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

  const shellProps = {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') props.onClose()
    },
  }

  if (props.mode === 'public') {
    const { incident } = props
    const severity = getSeverityStyle(incident.severity)
    const status = statusMeta(incident.status)
    const hazard = getHazardTypePresentation(incident.reportType)
    const HazardIcon = hazard.icon

    return (
      <section
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 z-[1001] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-8 pt-2 shadow-2xl"
        {...shellProps}
      >
        <div className="flex justify-center pb-4 pt-2">
          <div className="h-1 w-8 rounded-full bg-surface-200" />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={props.onClose}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-100 text-surface-500"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pr-12">
          <div className="flex items-center gap-2">
            <span style={{ color: hazard.colorToken }}>
              <HazardIcon size={20} aria-hidden="true" />
            </span>
            <p className="text-xl font-extrabold text-surface-900">{hazard.label}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest"
              style={{ backgroundColor: severity.bg, color: severity.fg }}
            >
              {severity.label}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest ${status.bg} ${status.color}`}
            >
              {status.label}
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          <MapPin size={14} className="text-surface-500" aria-hidden="true" />
          <p className="text-sm font-medium text-surface-900">
            {incident.barangayId ? `${incident.barangayId}, ` : ''}
            {incident.municipalityLabel}
          </p>
        </div>
        <p className="mt-1 text-xs text-surface-500">Reported {timeAgo(incident.submittedAt)}</p>
        <Link
          to={`/incidents/${encodeURIComponent(incident.id)}`}
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white"
        >
          View incident details
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        {props.onReportSimilar ? (
          <button
            type="button"
            onClick={props.onReportSimilar}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-surface-200 bg-surface-100 px-4 text-sm font-semibold text-surface-900"
          >
            <Zap size={14} aria-hidden="true" />
            Report similar incident nearby
          </button>
        ) : null}
      </section>
    )
  }

  const { report } = props
  const timeline = buildTrackingTimeline(report)
  const status = getOperationalStagePresentation(timeline.currentStage)
  const hazard = getHazardTypePresentation(report.reportType)
  const StatusIcon = status.icon

  return (
    <section
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="absolute inset-x-0 bottom-0 z-[1001] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-8 pt-2 shadow-2xl"
      {...shellProps}
    >
      <div className="flex justify-center pb-4 pt-2">
        <div className="h-1 w-8 rounded-full bg-surface-200" />
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={props.onClose}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-100 text-surface-500"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-12 text-sm font-bold text-surface-900">Your {hazard.label} report</p>
      <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div
          className="flex items-center gap-2 text-sm font-bold"
          style={{ color: status.colorToken }}
        >
          <StatusIcon size={18} aria-hidden="true" />
          <span>{status.label}</span>
        </div>
        <h2 className="mt-2 text-xl font-extrabold text-surface-900">{timeline.headline}</h2>
        <p className="mt-1 text-sm leading-relaxed text-surface-700">{timeline.explanation}</p>
      </div>
      <div className="mb-4 mt-4 flex items-center justify-between rounded-lg bg-surface-100 px-4 py-3">
        <div>
          <p className="mb-1 text-[0.625rem] font-bold uppercase tracking-widest text-surface-500">
            Tracking code
          </p>
          <span className="font-extrabold text-surface-900">{report.publicRef}</span>
        </div>
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy'}
          onClick={() => {
            void handleCopy(report.publicRef)
          }}
          className="min-h-11 px-2 text-sm font-medium text-brand-600"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Link
        to={`/track/${encodeURIComponent(report.publicRef)}`}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white"
      >
        View full response
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}
