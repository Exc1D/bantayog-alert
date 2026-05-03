import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentLabel, statusMeta, severityDotColor } from '../utils/incident-meta.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

const NON_TERMINAL: ReadonlySet<string> = new Set([...ACTIVE_REPORT_STATUSES, 'reopened'])

function isNonTerminal(status: string): boolean {
  return status === 'queued' || NON_TERMINAL.has(status)
}

export function ReportStatusPill() {
  const navigate = useNavigate()
  const { reports } = useMyActiveReports()
  const prefersReducedMotion = useReducedMotion()

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
              key="report-status-pill"
              type="button"
              initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
              }
              onClick={() => {
                void navigate(`/reports/${primary.publicRef}`)
              }}
              className="fixed left-1/2 -translate-x-1/2 z-toast flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-900/90 backdrop-blur-sm shadow-lg active:scale-95 transition-transform"
              style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
              aria-label={`View your active report: ${incidentLabel(primary.reportType)}`}
            >
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
