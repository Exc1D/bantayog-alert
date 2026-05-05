import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentLabel, statusMeta, severityDotColor } from '../utils/incident-meta.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { useState, useRef } from 'react'

const NON_TERMINAL: ReadonlySet<string> = new Set([...ACTIVE_REPORT_STATUSES, 'reopened'])

function isNonTerminal(status: string): boolean {
  return status === 'queued' || NON_TERMINAL.has(status)
}

const DRAG_THRESHOLD = 4

interface DragStart {
  x: number
  y: number
  offsetX: number
  offsetY: number
}

export function ReportStatusPill() {
  const navigate = useNavigate()
  const { reports } = useMyActiveReports()
  const prefersReducedMotion = useReducedMotion()
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showPulse, setShowPulse] = useState(() => !localStorage.getItem('pill-tapped'))
  const startRef = useRef<DragStart | null>(null)
  const movedRef = useRef(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY, offsetX: dragOffset.x, offsetY: dragOffset.y }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startRef.current === null) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      movedRef.current = true
    }
    const newX = startRef.current.offsetX + dx
    const newY = startRef.current.offsetY + dy
    const maxX = window.innerWidth / 2 - 50
    const buttonHeight = buttonRef.current?.clientHeight ?? 44
    const bottomOffset =
      64 /* 4rem */ +
      (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0)
    const maxYUp = window.innerHeight - bottomOffset - buttonHeight
    // Pill is anchored at the bottom; allow only minimal downward slack
    const maxYDown = Math.round(buttonHeight * 0.25)
    setDragOffset({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxYUp, Math.min(maxYDown, newY)),
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    startRef.current = null
  }

  const activeReports = reports.filter((r) => isNonTerminal(r.status))

  return (
    <AnimatePresence>
      {activeReports.length > 0 &&
        (() => {
          const sorted = [...activeReports].sort((a, b) => b.submittedAt - a.submittedAt)
          const primary = sorted[0]
          if (!primary) return null
          const extraCount = sorted.length - 1
          const meta = statusMeta(primary.status)

          return (
            <motion.button
              ref={buttonRef}
              key="report-status-pill"
              type="button"
              initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
              }
              onClick={() => {
                if (movedRef.current) {
                  movedRef.current = false
                  return
                }
                if (showPulse) {
                  localStorage.setItem('pill-tapped', '1')
                  setShowPulse(false)
                }
                void navigate(`/reports/${primary.publicRef}`)
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`fixed z-toast flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-900/90 backdrop-blur-sm shadow-lg active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 hover:brightness-110 ${showPulse ? 'animate-pulse-glow' : ''}`}
              style={{
                left: '50%',
                bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
                transform: `translateX(calc(-50% + ${String(dragOffset.x)}px)) translateY(${String(dragOffset.y)}px)`,
                touchAction: 'none',
              }}
              aria-label={`View your active report: ${incidentLabel(primary.reportType)}`}
            >
              <span className="flex gap-0.5 mr-1">
                <span className="w-1 h-1 rounded-full bg-surface-400" />
                <span className="w-1 h-1 rounded-full bg-surface-400" />
              </span>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: severityDotColor(primary.severity) }}
              />
              <span className="text-white text-sm font-medium">
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
            </motion.button>
          )
        })()}
    </AnimatePresence>
  )
}
