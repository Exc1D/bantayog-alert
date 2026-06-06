import { useNavigate } from 'react-router-dom'
import { ChevronRight, Bell, X, Siren } from 'lucide-react'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentLabel, statusMeta, severityDotColor } from '../utils/incident-meta.js'
import { useState, useRef, useCallback, useMemo } from 'react'

const NON_TERMINAL: ReadonlySet<string> = new Set([...ACTIVE_REPORT_STATUSES, 'reopened'])
const RESPONDERS_ON_WAY_STATUSES: ReadonlySet<string> = new Set([
  'assigned',
  'acknowledged',
  'en_route',
])

function isNonTerminal(status: string): boolean {
  return status === 'queued' || NON_TERMINAL.has(status)
}

const DRAG_THRESHOLD = 4

interface DragStart {
  x: number
  y: number
  el: HTMLElement
}

export function ReportStatusPill({
  suppressResponderNotice = false,
}: {
  suppressResponderNotice?: boolean
}) {
  const navigate = useNavigate()
  const { reports } = useMyActiveReports()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPulse, setShowPulse] = useState(() => {
    try {
      return !localStorage.getItem('pill-tapped')
    } catch {
      return true
    }
  })
  const [dismissedResponderNoticeKey, setDismissedResponderNoticeKey] = useState<string | null>(
    null,
  )
  const startRef = useRef<DragStart | null>(null)
  const movedRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const activeReports = useMemo(() => reports.filter((r) => isNonTerminal(r.status)), [reports])
  const hasReports = activeReports.length > 0
  const responderNotice = useMemo(
    () =>
      [...activeReports]
        .filter((report) => RESPONDERS_ON_WAY_STATUSES.has(report.status))
        .sort((a, b) => (b.lastStatusAt ?? b.submittedAt) - (a.lastStatusAt ?? a.submittedAt))[0],
    [activeReports],
  )
  const responderNoticeKey = responderNotice
    ? `${responderNotice.id ?? responderNotice.publicRef}:${responderNotice.status}:${String(responderNotice.lastStatusAt ?? responderNotice.submittedAt)}`
    : null
  const showResponderNotice =
    !suppressResponderNotice &&
    responderNotice !== undefined &&
    responderNoticeKey !== null &&
    responderNoticeKey !== dismissedResponderNoticeKey

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = wrapperRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY, el }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      movedRef.current = true
    }
    const { el } = startRef.current
    // Direct DOM manipulation — no React state, no re-renders during drag
    const currentTransform = new DOMMatrix(getComputedStyle(el).transform)
    el.style.transform = `translate3d(${String(currentTransform.m41 + dx)}px, ${String(currentTransform.m42 + dy)}px, 0)`
    startRef.current.x = e.clientX
    startRef.current.y = e.clientY
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const el = wrapperRef.current
    if (!el) return
    el.releasePointerCapture(e.pointerId)
    startRef.current = null
  }, [])

  const handleClick = useCallback(() => {
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    if (!isExpanded) {
      setIsExpanded(true)
      if (showPulse) {
        try {
          localStorage.setItem('pill-tapped', '1')
        } catch {
          /* noop - localStorage may be unavailable in private mode */
        }
        setShowPulse(false)
      }
      return
    }
    // Expanded + click = navigate to map
    const sorted = [...activeReports].sort((a, b) => b.submittedAt - a.submittedAt)
    const primary = sorted[0]
    if (primary) {
      void navigate('/')
    }
  }, [isExpanded, showPulse, activeReports, navigate])

  if (!hasReports) return null

  const sorted = [...activeReports].sort((a, b) => b.submittedAt - a.submittedAt)
  const primary = sorted[0]
  if (!primary) return null
  const extraCount = sorted.length - 1
  const meta = statusMeta(primary.status)
  const dotColor = severityDotColor(primary.severity)

  return (
    <>
      {showResponderNotice && (
        <div className="fixed inset-0 z-[10000] bg-surface-900/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="responder-notice-title"
            className="absolute left-1/2 top-1/2 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-500/10 text-success-600">
                <Siren size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="responder-notice-title" className="m-0 text-lg font-bold text-surface-900">
                  Responders are on their way
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-surface-700">
                  {incidentLabel(responderNotice.reportType)}
                  {responderNotice.municipalityLabel
                    ? ` in ${responderNotice.municipalityLabel}`
                    : ''}{' '}
                  has been assigned to responders.
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss responder notification"
                className="rounded-full p-2 text-surface-500 active:bg-surface-100"
                onClick={() => {
                  setDismissedResponderNoticeKey(responderNoticeKey)
                }}
              >
                <X size={18} />
              </button>
            </div>
            <button
              type="button"
              className="mt-2 h-11 w-full rounded-lg border-none bg-brand-600 text-sm font-bold text-white"
              onClick={() => {
                setDismissedResponderNoticeKey(responderNoticeKey)
                void navigate('/')
              }}
            >
              View report
            </button>
          </div>
        </div>
      )}
      <div
        ref={wrapperRef}
        className="report-status-pill fixed z-toast touch-none select-none right-4 top-1/2 -translate-y-1/2"
      >
        <button
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-all duration-200 ${
            showPulse ? 'animate-pulse-glow' : ''
          } ${isExpanded ? 'bg-surface-900/90 px-4 py-2.5 gap-2' : 'w-12 h-12 bg-brand-600'}`}
          aria-label={
            isExpanded
              ? `View your active report: ${incidentLabel(primary.reportType)}`
              : `You have ${String(activeReports.length)} active report${activeReports.length > 1 ? 's' : ''}. Tap to view.`
          }
        >
          {isExpanded ? (
            <>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-white text-sm font-medium whitespace-nowrap">
                {incidentLabel(primary.reportType)}
                {primary.municipalityLabel ? ` · ${primary.municipalityLabel}` : ''}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}
              >
                {meta.label}
              </span>
              {extraCount > 0 && (
                <span className="text-xs font-bold text-surface-300">+{String(extraCount)}</span>
              )}
              <ChevronRight size={14} className="text-surface-300 flex-shrink-0" />
            </>
          ) : (
            <>
              <Bell size={20} className="text-white" />
              {extraCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {extraCount > 9 ? '9+' : String(extraCount + 1)}
                </span>
              )}
              <span
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
                style={{ backgroundColor: dotColor }}
              />
            </>
          )}
        </button>
      </div>
    </>
  )
}
