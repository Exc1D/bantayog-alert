import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { MapPin, X, Zap, PhoneCall } from 'lucide-react'
import { actionsFor } from '../../lib/reportActions.js'
import { statusMeta } from '../../utils/incident-meta.js'
import { getSeverityStyle } from '../../utils/useSeverityStyle.js'
import { Timeline } from '../ui/Timeline.js'
import type { MyReport, PublicIncident } from './types.js'

const RESPONDER_PHONE_NUMBER = '0547211216'

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
      onCancelReport?: (publicRef: string, reportId?: string) => void
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

type ProgressStatus = 'new' | 'awaiting_verify' | 'verified' | 'en_route' | 'resolved'

interface TrackingEvent {
  label: string
  meta: string
  state: 'complete' | 'pending' | 'queued' | 'failed'
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

function progressStatus(status: MyReport['status']): ProgressStatus {
  if (status === 'queued' || status === 'draft_inbox' || status === 'new') return 'new'
  if (status === 'awaiting_verify') return 'awaiting_verify'
  if (status === 'verified' || status === 'assigned' || status === 'acknowledged') return 'verified'
  if (status === 'en_route' || status === 'on_scene') return 'en_route'
  return 'resolved'
}

function updatedMeta(report: MyReport): string {
  return `Updated ${timeAgo(report.lastStatusAt ?? report.submittedAt)}`
}

function trackingStage(status: MyReport['status']): number {
  if (status === 'new' || status === 'awaiting_verify') return 1
  if (status === 'verified' || status === 'reopened') return 2
  if (
    status === 'assigned' ||
    status === 'acknowledged' ||
    status === 'en_route' ||
    status === 'on_scene'
  ) {
    return 3
  }
  if (status === 'resolved' || status === 'closed') return 4
  return 0
}

function buildTrackingTimeline(report: MyReport): TrackingEvent[] {
  if (report.status === 'queued' || report.status === 'draft_inbox') {
    return [
      { label: 'Saved on this phone', meta: timeAgo(report.submittedAt), state: 'queued' },
      { label: 'Send when online', meta: 'Automatic retry is enabled', state: 'pending' },
      { label: 'Report received', meta: 'Waiting for MDRRMO receipt', state: 'pending' },
    ]
  }

  if (report.status === 'rejected') {
    return [
      { label: 'Report received', meta: timeAgo(report.submittedAt), state: 'complete' },
      { label: 'First review', meta: updatedMeta(report), state: 'complete' },
      { label: 'Not accepted', meta: 'MDRRMO did not accept this report', state: 'failed' },
    ]
  }

  if (report.status === 'cancelled' || report.status === 'cancelled_false_report') {
    return [
      { label: 'Report received', meta: timeAgo(report.submittedAt), state: 'complete' },
      { label: 'Cancelled', meta: updatedMeta(report), state: 'complete' },
    ]
  }

  if (report.status === 'merged_as_duplicate') {
    return [
      { label: 'Report received', meta: timeAgo(report.submittedAt), state: 'complete' },
      { label: 'Merged with another report', meta: updatedMeta(report), state: 'complete' },
    ]
  }

  const stage = trackingStage(report.status)
  const responseLabel = report.status === 'on_scene' ? 'Responder on scene' : 'Responder en route'
  const steps = [
    { label: 'Report received', meta: timeAgo(report.submittedAt) },
    { label: 'First review', meta: stage === 1 ? updatedMeta(report) : 'MDRRMO reviewed' },
    { label: 'Verified', meta: stage === 2 ? updatedMeta(report) : 'Incident confirmed' },
    { label: responseLabel, meta: stage === 3 ? updatedMeta(report) : 'Waiting for dispatch' },
    { label: 'Resolution', meta: stage === 4 ? updatedMeta(report) : 'Waiting for final update' },
  ]

  return steps.map((step, index) => {
    if (stage >= 4 || index < stage) return { ...step, state: 'complete' as const }
    if (index === stage) return { ...step, state: 'pending' as const }
    return { ...step, state: 'queued' as const }
  })
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
    const style = getSeverityStyle(incident.severity)
    const sm = statusMeta(incident.status)
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
    return (
      <section
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 z-[1001] bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto px-4 pb-8 pt-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose()
        }}
      >
        {dragHandle}

        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xl font-extrabold text-surface-900">
              {LABELS[incident.reportType] ?? incident.reportType}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span
                className="inline-block px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold tracking-widest uppercase"
                style={{ backgroundColor: style.bg, color: style.fg }}
              >
                {style.label}
              </span>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold tracking-widest uppercase ${sm.bg} ${sm.color}`}
              >
                {sm.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={props.onClose}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-surface-100 text-surface-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} className="inline text-surface-500" aria-hidden="true" />
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
            <Zap size={14} className="inline" aria-hidden="true" />
            Report similar incident nearby
          </button>
        ) : null}
      </section>
    )
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
  }

  const report = props.report
  const displayStatus = progressStatus(report.status)
  const actions = actionsFor(displayStatus)
  const trackingEvents = buildTrackingTimeline(report)

  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
  return (
    <section
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="absolute inset-x-0 bottom-0 z-[1001] bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto px-4 pb-8 pt-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose()
      }}
    >
      {dragHandle}
      <p className="font-extrabold text-surface-900">Your Report</p>
      <p className="mt-1 mb-2 font-bold text-lg text-surface-900">
        {LABELS[report.reportType] ?? report.reportType}
        {report.status !== 'queued' && report.status !== 'new'
          ? ` · ${report.status.replace(/_/g, ' ')}`
          : ' · Awaiting Review'}
      </p>
      {(() => {
        const s = getSeverityStyle(report.severity)
        return (
          <span
            className="inline-block mb-2 px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold tracking-widest uppercase"
            style={{ backgroundColor: s.bg, color: s.fg }}
          >
            {s.label}
          </span>
        )
      })()}
      {report.municipalityLabel ? (
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin size={14} className="inline text-surface-500" aria-hidden="true" />
          <p className="text-sm text-surface-500">{report.municipalityLabel}</p>
        </div>
      ) : null}
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
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="mb-5">
        <h2 className="mb-3 text-xs font-bold tracking-widest uppercase text-surface-500">
          Tracking timeline
        </h2>
        <Timeline events={trackingEvents} />
      </div>
      {actions.includes('edit') && report.id ? (
        <button type="button" aria-label="Edit report" className="mb-2">
          Edit
        </button>
      ) : null}
      {actions.includes('request_correction') ? (
        <button type="button" aria-label="Request correction" className="mb-2">
          Request Correction
        </button>
      ) : null}
      <div className="flex gap-2 mb-3">
        <a
          href={`tel:${RESPONDER_PHONE_NUMBER}`}
          className="flex-1 py-3 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          <PhoneCall size={14} />
          Call responders
        </a>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={props.onClose}
        className="w-full py-2.5 text-surface-900 text-sm font-medium text-center bg-surface-100 rounded-lg transition-colors"
      >
        Close
      </button>
    </section>
  )
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
}
