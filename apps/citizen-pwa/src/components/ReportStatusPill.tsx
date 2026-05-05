import { useNavigate } from 'react-router-dom'
import { ChevronRight, Bell } from 'lucide-react'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentLabel, statusMeta, severityDotColor } from '../utils/incident-meta.js'
import { useState, useRef, useCallback } from 'react'

const NON_TERMINAL: ReadonlySet<string> = new Set([...ACTIVE_REPORT_STATUSES, 'reopened'])

function isNonTerminal(status: string): boolean {
  return status === 'queued' || NON_TERMINAL.has(status)
}

const DRAG_THRESHOLD = 4

interface DragStart {
  x: number
  y: number
  el: HTMLElement
}

export function ReportStatusPill() {
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
  const startRef = useRef<DragStart | null>(null)
  const movedRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const activeReports = reports.filter((r) => isNonTerminal(r.status))
  const hasReports = activeReports.length > 0

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
    // Expanded + click = navigate to report
    const sorted = [...activeReports].sort((a, b) => b.submittedAt - a.submittedAt)
    const primary = sorted[0]
    if (primary) {
      void navigate(`/reports/${primary.publicRef}`)
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
    <div
      ref={wrapperRef}
      className="fixed z-toast touch-none select-none"
      style={{
        right: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        touchAction: 'none',
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-all duration-200 ${
          showPulse ? 'animate-pulse-glow' : ''
        } ${
          isExpanded
            ? 'bg-surface-900/90 backdrop-blur-sm px-4 py-2.5 gap-2'
            : 'w-12 h-12 bg-brand-600'
        }`}
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
  )
}
