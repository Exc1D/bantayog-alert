import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useResponderAvailability } from '../hooks/useResponderAvailability'
import { fetchReportData } from '../hooks/useReportData'
import { Timestamp } from 'firebase/firestore'
import type { DispatchStatus } from '@bantayog/shared-types'
import { calculateDeadlineMinutes } from '../lib/deadline-calculation'

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Severity = 'high' | 'medium' | 'low'

interface DispatchRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  severity: Severity
  incidentType: string
  location: string
  barangay: string
  municipality: string
  adminName: string
  adminAgency: string
  deadlineMinutes: number
  dispatchedAt: Timestamp
  acknowledgementDeadlineAt?: Timestamp
}

/* ------------------------------------------------------------------ */
/*  Severity Indicator                                                  */
/* ------------------------------------------------------------------ */

const SeverityIndicator = ({ severity }: { severity: Severity }) => {
  const allConfigs = {
    high: {
      color: 'text-app-urgent',
      bg: 'bg-app-urgent/20',
      Icon: AlertTriangle,
      label: 'HIGH',
    },
    medium: {
      color: 'text-app-warning',
      bg: 'bg-app-warning/20',
      Icon: AlertCircle,
      label: 'MED',
    },
    low: {
      color: 'text-app-operational',
      bg: 'bg-app-operational/20',
      Icon: Info,
      label: 'LOW',
    },
  } as const
  type SeverityKey = keyof typeof allConfigs
  const validSeverity: SeverityKey = severity in allConfigs ? severity : 'low'
  const c = allConfigs[validSeverity]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-app-xs font-semibold ${c.bg} ${c.color}`}
    >
      <c.Icon size={14} />
      {c.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Status Pill                                                         */
/* ------------------------------------------------------------------ */

const StatusPill = ({ status }: { status: DispatchStatus }) => {
  const config: Record<
    DispatchStatus,
    { color: string; bg: string; label: string }
  > = {
    pending: {
      color: 'text-app-urgent',
      bg: 'bg-app-urgent/20',
      label: 'Pending',
    },
    accepted: {
      color: 'text-app-warning',
      bg: 'bg-app-warning/20',
      label: 'Accepted',
    },
    acknowledged: {
      color: 'text-app-warning',
      bg: 'bg-app-warning/20',
      label: 'Acknowledged',
    },
    en_route: {
      color: 'text-app-operational',
      bg: 'bg-app-operational/20',
      label: 'En Route',
    },
    on_scene: {
      color: 'text-app-operational',
      bg: 'bg-app-operational/30',
      label: 'On Scene',
    },
    resolved: {
      color: 'text-app-text-secondary',
      bg: 'bg-app-surface-elevated',
      label: 'Resolved',
    },
    timed_out: {
      color: 'text-app-text-secondary',
      bg: 'bg-app-surface-elevated',
      label: 'Timed Out',
    },
    cancelled: {
      color: 'text-app-text-secondary',
      bg: 'bg-app-surface-elevated',
      label: 'Cancelled',
    },
    unable_to_complete: {
      color: 'text-app-danger',
      bg: 'bg-app-danger/20',
      label: 'Unable',
    },
    declined: {
      color: 'text-app-text-secondary',
      bg: 'bg-app-surface-elevated',
      label: 'Declined',
    },
    superseded: {
      color: 'text-app-text-secondary',
      bg: 'bg-app-surface-elevated',
      label: 'Superseded',
    },
  }
  const c = config[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-app-xs font-medium ${c.bg} ${c.color}`}
    >
      {c.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Countdown Ring                                                      */
/* ------------------------------------------------------------------ */

const CountdownRing = ({
  deadlineSeconds,
  totalSeconds,
}: {
  deadlineSeconds: number
  totalSeconds: number
}) => {
  const radius = 56
  const stroke = 8
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const progress = Math.max(0, Math.min(1, deadlineSeconds / totalSeconds))
  const strokeDashoffset = circumference - progress * circumference

  const mins = Math.floor(deadlineSeconds / 60)
  const secs = deadlineSeconds % 60

  return (
    <div className="relative flex items-center justify-center w-32 h-32 mx-auto my-4">
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          stroke="oklch(35% 0.02 200)"
          strokeWidth={stroke}
        />
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          stroke="oklch(55% 0.22 30)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-app-text-primary">
        <span className="text-app-xl font-bold tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
        <span className="text-app-xs text-app-text-secondary">remaining</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export function DispatchListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { rows, groups, error } = useOwnDispatches(user?.uid)
  const { status: availabilityStatus } = useResponderAvailability(user?.uid)

  const [filter, setFilter] = useState<'new' | 'active' | 'done'>('new')
  const [reportData, setReportData] = useState<Record<string, { severity: Severity; incidentType: string; barangay: string; municipality: string }>>({})

  // Fetch report data for dispatches
  useEffect(() => {
    const reportIds = [...groups.pending, ...groups.active].map((r) => r.reportId)
    const uniqueReportIds = [...new Set(reportIds)]
    
    if (uniqueReportIds.length === 0) return

    // Fetch report data for each unique report
    Promise.all(
      uniqueReportIds.map(async (reportId) => {
        try {
          const report = await fetchReportData(reportId)
          if (report) {
            return {
              reportId,
              data: {
                severity: report.severity,
                incidentType: report.reportType,
                barangay: report.barangay,
                municipality: report.municipality,
              },
            }
          }
        } catch (err) {
          console.error('[DispatchListPage] Failed to fetch report:', reportId, err)
        }
        return null
      })
    ).then((results) => {
      const data: Record<string, { severity: Severity; incidentType: string; barangay: string; municipality: string }> = {}
      results.forEach((result) => {
        if (result) {
          data[result.reportId] = result.data
        }
      })
      setReportData(data)
    })
  }, [groups.pending, groups.active])

  // Get pending dispatch
  const pendingDispatch = useMemo(() => {
    return groups.pending[0]
  }, [groups.pending])

  // Get active dispatches with enriched data
  const activeDispatches = useMemo(() => {
    return groups.active.map((row) => {
      const report = reportData[row.reportId]
      const dispatch = rows.find((r) => r.dispatchId === row.dispatchId)
      const deadlineMinutes = calculateDeadlineMinutes(
        dispatch?.acknowledgementDeadlineAt,
        dispatch?.dispatchedAt
      )

      return {
        dispatchId: row.dispatchId,
        reportId: row.reportId,
        status: row.status,
        severity: report?.severity ?? 'medium',
        incidentType: report?.incidentType ?? 'Incident',
        location: report ? `${report.barangay}, ${report.municipality}` : 'Unknown location',
        barangay: report?.barangay ?? 'Unknown',
        municipality: report?.municipality ?? 'Unknown',
        adminName: 'Admin',
        adminAgency: 'MDRRMO',
        deadlineMinutes,
        dispatchedAt: dispatch?.dispatchedAt ?? Timestamp.now(),
        acknowledgementDeadlineAt: dispatch?.acknowledgementDeadlineAt,
      }
    })
  }, [groups.active, rows, reportData])

  // Filter dispatches
  const filtered = useMemo(() => {
    return activeDispatches.filter((d) => {
      if (filter === 'new')
        return ['accepted', 'acknowledged', 'en_route'].includes(d.status)
      if (filter === 'active') return d.status === 'on_scene'
      if (filter === 'done')
        return ['resolved', 'timed_out', 'cancelled', 'unable_to_complete'].includes(
          d.status
        )
      return true
    })
  }, [activeDispatches, filter])

  // Countdown state for pending
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!pendingDispatch?.acknowledgementDeadlineAt) return
    const deadline = pendingDispatch.acknowledgementDeadlineAt.toMillis()
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pendingDispatch])

  /* ================================================================= */
  /*  A. All Clear                                                      */
  /* ================================================================= */
  if (!pendingDispatch && filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-app-lg text-center">
        <div className="mb-6">
          <Shield size={64} className="text-app-operational mx-auto mb-4" />
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-app-operational opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-app-operational" />
            </span>
            <h2 className="text-app-2xl font-bold text-app-text-primary">
              All Clear!
            </h2>
          </div>
          <p className="text-app-text-secondary text-app-base max-w-xs mx-auto">
            No active dispatches. Stay ready — new dispatches will appear here.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="min-h-[44px] min-w-[44px] w-full px-app-lg py-app-md rounded-lg bg-app-surface text-app-text-primary font-medium text-app-sm text-center"
          >
            View Past Dispatches
          </button>
          <button
            type="button"
            onClick={() => navigate('/dispatches/witness-report')}
            className="min-h-[44px] min-w-[44px] w-full px-app-lg py-app-md rounded-lg bg-app-operational text-white font-medium text-app-sm flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Report What I'm Seeing
          </button>
          <div className="flex items-center justify-center gap-2 text-app-sm text-app-text-secondary">
            <span
              className={`w-2 h-2 rounded-full ${
                availabilityStatus === 'available' ? 'bg-app-operational' : 'bg-app-warning'
              }`}
            />
            Status: {availabilityStatus ?? 'loading…'}
          </div>
        </div>
      </div>
    )
  }

  /* ================================================================= */
  /*  B. Incoming Dispatch Overlay                                      */
  /* ================================================================= */
  if (pendingDispatch) {
    const report = reportData[pendingDispatch.reportId]
    const deadline = pendingDispatch.acknowledgementDeadlineAt
    const totalSeconds =
      typeof deadline === 'number'
        ? Math.max(60, Math.ceil((deadline - pendingDispatch.dispatchedAt) / 1000))
        : 180

    return (
      <div className="relative h-full">
        {/* backdrop */}
        <div className="absolute inset-0 bg-app-bg/80 z-10" />

        {/* slide-up panel */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{
            duration: 0.3,
            ease: [0, 0, 0.2, 1] as [number, number, number, number],
          }}
          className="absolute inset-x-0 bottom-0 z-20 bg-app-surface-elevated rounded-t-2xl px-app-lg pt-app-xl pb-app-2xl shadow-2xl"
        >
          <div className="mx-auto w-12 h-1 rounded-full bg-app-border mb-6" />

          {/* severity badge */}
          <div className="flex justify-center mb-3">
            <SeverityIndicator severity={report?.severity ?? 'medium'} />
          </div>

          {/* incident type */}
          <h2 className="text-app-2xl font-bold text-app-text-primary text-center mb-1">
            {report?.incidentType ?? 'New Dispatch'}
          </h2>

          {/* location */}
          <p className="text-app-lg text-app-text-secondary text-center mb-2">
            {report ? `${report.barangay}, ${report.municipality}` : pendingDispatch.reportId}
          </p>

          {/* admin */}
          <p className="text-app-sm text-app-text-muted text-center mb-6">
            Dispatched by Admin · MDRRMO
          </p>

          {/* countdown ring */}
          <CountdownRing
            deadlineSeconds={secondsLeft}
            totalSeconds={totalSeconds}
          />

          {/* action buttons */}
          <div className="flex flex-col gap-3 mt-2">
            <button
              type="button"
              onClick={() => {
                navigate(`/dispatches/${pendingDispatch.dispatchId}`)
              }}
              className="min-h-[44px] min-w-[44px] w-full px-app-lg py-app-md rounded-lg bg-app-danger text-white font-semibold text-app-base"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(`/dispatches/${pendingDispatch.dispatchId}`)
              }}
              className="min-h-[44px] min-w-[44px] w-full px-app-lg py-app-md rounded-lg bg-app-operational text-white font-semibold text-app-base"
            >
              Accept
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  /* ================================================================= */
  /*  C. Active Dispatch List                                         */
  /* ================================================================= */
  return (
    <div className="h-full flex flex-col">
      {/* filter tabs */}
      <div className="flex items-center gap-2 px-app-lg pt-app-md pb-app-sm">
        <FilterTab
          active={filter === 'new'}
          onClick={() => setFilter('new')}
          dotColor="bg-app-urgent"
          label="New"
        />
        <FilterTab
          active={filter === 'active'}
          onClick={() => setFilter('active')}
          dotColor="bg-app-warning"
          label="Active"
        />
        <FilterTab
          active={filter === 'done'}
          onClick={() => setFilter('done')}
          dotColor="bg-app-operational"
          label="Done"
        />
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-app-lg pb-app-lg">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-40 text-app-text-secondary text-app-sm"
            >
              No dispatches in this category.
            </motion.div>
          ) : (
            filtered.map((dispatch) => (
              <motion.button
                key={dispatch.dispatchId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  duration: 0.2,
                  ease: [0, 0, 0.2, 1] as [number, number, number, number],
                }}
                type="button"
                onClick={() => navigate(`/dispatches/${dispatch.dispatchId}`)}
                className="min-h-[44px] min-w-[44px] w-full text-left bg-app-surface rounded-xl p-app-lg mb-3 flex items-start gap-3 active:bg-app-surface-elevated transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-app-base font-semibold text-app-text-primary">
                      {dispatch.incidentType}
                    </span>
                    <SeverityIndicator severity={dispatch.severity} />
                  </div>
                  <p className="text-app-sm text-app-text-secondary mb-2 truncate">
                    {dispatch.barangay}, {dispatch.municipality}
                  </p>
                  <StatusPill status={dispatch.status} />
                </div>
                <ChevronRight
                  size={20}
                  className="text-app-text-muted mt-1 shrink-0"
                />
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="px-app-lg py-app-md">
          <p className="text-app-danger text-app-sm">Failed to load dispatches: {error}</p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  FilterTab helper                                                    */
/* ------------------------------------------------------------------ */

function FilterTab({
  active,
  onClick,
  dotColor,
  label,
}: {
  active: boolean
  onClick: () => void
  dotColor: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-app-sm font-medium transition-colors ${
        active
          ? 'bg-app-surface-elevated text-app-text-primary'
          : 'text-app-text-muted'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {label}
    </button>
  )
}
