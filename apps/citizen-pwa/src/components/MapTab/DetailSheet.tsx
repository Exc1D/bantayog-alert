import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { MapPin, X, Zap, PhoneCall } from 'lucide-react'
import { actionsFor } from '../../lib/reportActions.js'
import { auth, fns, httpsCallable } from '../../services/firebase.js'
import { statusMeta } from '../../utils/incident-meta.js'
import { getSeverityStyle } from '../../utils/useSeverityStyle.js'
import { Timeline } from '../ui/Timeline.js'
import type { MyReport, PublicIncident } from './types.js'

const RESPONDER_PHONE_NUMBER = '0547211216'
const FEEDBACK_STORAGE_PREFIX = 'bantayog.reportFeedbackSubmitted.'

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

interface CitizenStatusHero {
  title: string
  explanation: string
  nextStep: string
  updated: string
}

interface ReportFeedbackPayload {
  reportId: string
  addressed: boolean
  comment?: string
}

type FeedbackStatus = 'idle' | 'submitting' | 'submitted' | 'error'

function feedbackStorageKey(reportId: string): string {
  return `${FEEDBACK_STORAGE_PREFIX}${reportId}`
}

function readFeedbackSubmitted(reportId: string | null): boolean {
  if (!reportId) return false
  try {
    return window.localStorage.getItem(feedbackStorageKey(reportId)) === '1'
  } catch {
    return false
  }
}

function markFeedbackSubmitted(reportId: string): void {
  try {
    window.localStorage.setItem(feedbackStorageKey(reportId), '1')
  } catch {
    // Local storage can be unavailable in private browsing; the callable remains authoritative.
  }
}

function isRegisteredCitizenSession(): boolean {
  try {
    const user = auth().currentUser
    return user !== null && !user.isAnonymous
  } catch {
    return false
  }
}

function buildFeedbackPayload(
  reportId: string,
  addressed: boolean,
  comment: string,
): ReportFeedbackPayload {
  const trimmedComment = comment.trim()
  return {
    reportId,
    addressed,
    ...(trimmedComment === '' ? {} : { comment: trimmedComment }),
  }
}

async function submitReportFeedback(payload: ReportFeedbackPayload): Promise<void> {
  const callable = httpsCallable<ReportFeedbackPayload>(fns(), 'submitReportFeedback')
  await callable(payload)
}

function ResolvedReportFeedbackPrompt({ reportId }: { reportId: string }) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(() => readFeedbackSubmitted(reportId))
  const [feedbackDismissed, setFeedbackDismissed] = useState(false)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  if (!isRegisteredCitizenSession()) return null
  if (feedbackSubmitted || feedbackStatus === 'submitted') {
    return (
      <div className="mb-4 rounded-xl border border-success-400/30 bg-success-400/10 px-4 py-3">
        <p className="text-sm font-semibold text-surface-900">Thanks for the feedback.</p>
        <p className="mt-1 text-xs text-surface-600">
          Your response helps MDRRMO close the loop on resolved reports.
        </p>
      </div>
    )
  }
  if (feedbackDismissed) return null

  async function handleSubmitFeedback(addressed: boolean): Promise<void> {
    setFeedbackStatus('submitting')
    setFeedbackError(null)
    try {
      await submitReportFeedback(buildFeedbackPayload(reportId, addressed, feedbackComment))
      markFeedbackSubmitted(reportId)
      setFeedbackSubmitted(true)
      setFeedbackStatus('submitted')
    } catch (err: unknown) {
      console.error('Failed to submit report feedback', err)
      setFeedbackStatus('error')
      setFeedbackError('We could not send your feedback. Please try again.')
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-surface-200 bg-white px-4 py-3 shadow-sm">
      <h2 className="text-sm font-bold text-surface-900">Was this addressed?</h2>
      <p className="mt-1 text-xs text-surface-600">
        A quick answer helps responders learn whether the situation was actually resolved.
      </p>
      <label
        htmlFor="report-feedback-comment"
        className="mt-3 block text-[0.625rem] font-bold uppercase tracking-widest text-surface-500"
      >
        Optional comment
      </label>
      <textarea
        id="report-feedback-comment"
        value={feedbackComment}
        onChange={(event) => {
          setFeedbackComment(event.target.value)
        }}
        maxLength={500}
        disabled={feedbackStatus === 'submitting'}
        rows={2}
        className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 disabled:opacity-60"
      />
      {feedbackError ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-500">
          {feedbackError}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void handleSubmitFeedback(true)
          }}
          disabled={feedbackStatus === 'submitting'}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {feedbackStatus === 'submitting' ? 'Sending' : 'Yes'}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSubmitFeedback(false)
          }}
          disabled={feedbackStatus === 'submitting'}
          className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-semibold text-surface-900 disabled:opacity-60"
        >
          No
        </button>
        <button
          type="button"
          onClick={() => {
            setFeedbackDismissed(true)
          }}
          disabled={feedbackStatus === 'submitting'}
          className="rounded-lg px-4 py-2 text-sm font-medium text-surface-500 disabled:opacity-60"
        >
          Not now
        </button>
      </div>
    </div>
  )
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

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function resolvedSpan(report: MyReport): string {
  const resolvedAt = report.lastStatusAt ?? report.submittedAt
  return `Reported ${timeLabel(report.submittedAt)}, resolved ${timeLabel(resolvedAt)}.`
}

function buildCitizenStatusHero(report: MyReport): CitizenStatusHero {
  const updated = updatedMeta(report)
  switch (report.status) {
    case 'queued':
    case 'draft_inbox':
      return {
        title: 'Saved on this phone',
        explanation: 'It will send automatically when you are back online.',
        nextStep: 'Keep this device available so the report can retry.',
        updated,
      }
    case 'new':
    case 'awaiting_verify':
      return {
        title: 'Your report was received',
        explanation:
          'An operator is checking the details. You do not need to submit again unless the situation changes.',
        nextStep: 'Watch this page for verification and responder updates.',
        updated,
      }
    case 'verified':
      return {
        title: 'Your report was verified',
        explanation: 'It is now being handled.',
        nextStep: 'Watch this page for responder updates.',
        updated,
      }
    case 'assigned':
    case 'acknowledged':
      return {
        title: 'A responder has been assigned',
        explanation: 'Please stay safe and avoid the affected area.',
        nextStep: 'Call responders only if the danger changes or people need urgent help.',
        updated,
      }
    case 'en_route':
      return {
        title: 'Help is on the way',
        explanation: 'Please stay safe and avoid the affected area.',
        nextStep: 'Keep this tracking code available for follow-up.',
        updated,
      }
    case 'on_scene':
      return {
        title: 'Responders are at or near the area',
        explanation: 'Emergency staff are checking the situation on scene.',
        nextStep: 'Stay clear of the affected area unless responders ask for information.',
        updated,
      }
    case 'resolved':
    case 'closed':
      return {
        title: 'This report was resolved',
        explanation: resolvedSpan(report),
        nextStep: 'Your report helped complete the response loop.',
        updated,
      }
    case 'rejected':
      return {
        title: 'This report could not be verified',
        explanation: 'The review did not confirm enough details to keep it active.',
        nextStep: 'Submit a new report only if the situation changes or you have clearer details.',
        updated,
      }
    case 'cancelled':
    case 'cancelled_false_report':
      return {
        title: 'Your report was withdrawn',
        explanation: 'It is no longer active, and the audit record is kept.',
        nextStep: 'Submit a new report only if there is a new or changing emergency.',
        updated,
      }
    case 'merged_as_duplicate':
      return {
        title: 'This report was merged with another report',
        explanation: 'Operators found another report for the same incident.',
        nextStep: 'The response continues through the main incident record.',
        updated,
      }
    case 'reopened':
      return {
        title: 'Your report is under review again',
        explanation: 'Operators reopened the report to check new information.',
        nextStep: 'Watch this page for the next status update.',
        updated,
      }
    default:
      return {
        title: 'Your report is being reviewed',
        explanation: 'Operators are checking the latest status.',
        nextStep: 'Watch this page for updates.',
        updated,
      }
  }
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
  const feedbackReportId = report.status === 'resolved' ? (report.id ?? null) : null
  const statusHero = buildCitizenStatusHero(report)

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
      <div className="mt-2 mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-[0.625rem] font-bold uppercase tracking-widest text-brand-600">
          {LABELS[report.reportType] ?? report.reportType}
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-surface-900">{statusHero.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-surface-700">{statusHero.explanation}</p>
        <p className="mt-2 text-xs font-semibold text-surface-700">{statusHero.nextStep}</p>
        <p className="mt-2 text-xs text-surface-500">{statusHero.updated}</p>
      </div>
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
      {feedbackReportId ? (
        <ResolvedReportFeedbackPrompt key={feedbackReportId} reportId={feedbackReportId} />
      ) : null}
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
