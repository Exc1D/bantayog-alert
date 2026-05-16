import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { CommandHeader } from '../components/CommandHeader'
import { StatusBar } from '../components/StatusBar'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { TrendAnalysisPanel } from '../components/TrendAnalysisPanel'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { AnomalyAlertPanel } from '../components/AnomalyAlertPanel'
import { ActiveIncidentsTable } from '../components/ActiveIncidentsTable'
import { useAuth } from '@bantayog/shared-ui'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useAudioAlerts } from '../hooks/useAudioAlerts'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import { callables } from '../services/callables'
import { db } from '../app/firebase'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import type { Report, MunicipalPerformance, AnomalyAlert, ReportStatus } from '../types'

function generateIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`
  }
}

interface FirestoreAlertDoc {
  id: string
  message?: unknown
  severity?: unknown
  detectedAt?: unknown
  municipality?: unknown
  type?: unknown
  dismissedAt?: unknown
}

function mapAlertDocToAnomalyAlert(doc: unknown): AnomalyAlert | null {
  if (doc == null || typeof doc !== 'object') return null
  const d = doc as FirestoreAlertDoc
  if (
    typeof d.message !== 'string' ||
    typeof d.severity !== 'string' ||
    typeof d.detectedAt !== 'string' ||
    typeof d.municipality !== 'string' ||
    typeof d.id !== 'string'
  ) {
    return null
  }
  const severity = d.severity as AnomalyAlert['severity']
  if (!['high', 'medium', 'low'].includes(severity)) return null
  const result: AnomalyAlert = {
    id: d.id,
    message: d.message,
    severity,
    detectedAt: d.detectedAt,
    municipality: d.municipality,
    type: typeof d.type === 'string' ? d.type : 'unknown',
    ...(typeof d.dismissedAt === 'string' ? { dismissedAt: d.dismissedAt } : {}),
  }
  return result
}

export default function DashboardPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastUpdatedAt] = useState(() => Date.now())
  const [bulkRejectIds, setBulkRejectIds] = useState<string[] | null>(null)
  const [bulkVerifyIds, setBulkVerifyIds] = useState<Set<string> | null>(null)
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())
  const [popupBlocked, setPopupBlocked] = useState(false)

  const { signOut } = useAuth()
  const { selectReport, selectedReportId, setSuppressNextBroadcast } = useCommandCenterStore()
  const { loading, error, reports, alerts } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })
  const { enabled: audioEnabled, toggle: toggleAudio, play, playError } = useAudioAlerts()
  const { sendSync, subscribe } = useWindowSyncContext()

  const prevIdsRef = useRef<Set<string>>(new Set())

  // Audio alert on new PENDING reports
  useEffect(() => {
    const currentPending = new Set(
      reports.filter((r) => r.status === 'awaiting_verify').map((r) => r.id),
    )
    const newArrivals = reports.filter(
      (r) => r.status === 'awaiting_verify' && !prevIdsRef.current.has(r.id),
    )
    if (newArrivals.length > 0) {
      play()
    }
    prevIdsRef.current = currentPending
  }, [reports, play])

  // Cross-window sync: receive from map
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'select:report' && msg.source === 'map') {
        selectReport(msg.reportId)
      }
    })
  }, [subscribe, selectReport])

  const clearActionError = useCallback(() => {
    setActionError(null)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const triageReports = useMemo(
    () => reports.filter((r) => r.status === 'new' || r.status === 'awaiting_verify'),
    [reports],
  )

  const trackingReports = useMemo(
    () => reports.filter((r) => r.status !== 'new' && r.status !== 'awaiting_verify'),
    [reports],
  )

  const selectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === triageReports.length ? new Set() : new Set(triageReports.map((r) => r.id)),
    )
  }, [triageReports])

  const handleVerify = useCallback(
    async (id: string) => {
      setLoadingActions((prev) => new Set(prev).add(id))
      try {
        await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Verify failed'
        setActionError(msg)
        playError()
      } finally {
        setLoadingActions((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [playError],
  )

  const handleReject = useCallback((id: string) => {
    setRejectTargetId(id)
    setRejectReason('')
    setRejectNotes('')
    setRejectModalOpen(true)
  }, [])

  const confirmReject = useCallback(async () => {
    if (!rejectTargetId && !bulkRejectIds) {
      setRejectModalOpen(false)
      return
    }
    if (!rejectReason) {
      setActionError('Please select a reason before rejecting.')
      playError()
      return
    }

    const ids = bulkRejectIds ?? [rejectTargetId]
    ids.forEach((id) => {
      if (id) setLoadingActions((prev) => new Set(prev).add(id))
    })
    try {
      for (const id of ids) {
        if (!id) continue
        const payload: {
          reportId: string
          reason: 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'
          idempotencyKey: string
          notes?: string
        } = {
          reportId: id,
          reason: rejectReason as
            | 'obviously_false'
            | 'duplicate'
            | 'test_submission'
            | 'insufficient_detail',
          idempotencyKey: generateIdempotencyKey(),
        }
        if (rejectNotes) {
          payload.notes = rejectNotes
        }
        await callables.rejectReport(payload)
      }
      setRejectModalOpen(false)
      setRejectTargetId(null)
      setBulkRejectIds(null)
      setSelectedIds(new Set())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reject failed'
      setActionError(msg)
      playError()
    } finally {
      ids.forEach((id) => {
        if (id) {
          setLoadingActions((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      })
    }
  }, [rejectTargetId, rejectReason, rejectNotes, playError, bulkRejectIds])

  const handleBulkVerify = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return
    setBulkVerifyIds(ids)
  }, [])

  const confirmBulkVerify = useCallback(async () => {
    if (!bulkVerifyIds) return
    bulkVerifyIds.forEach((id) => {
      setLoadingActions((prev) => new Set(prev).add(id))
    })
    try {
      for (const id of bulkVerifyIds) {
        try {
          await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Bulk verify failed'
          setActionError(msg)
          playError()
          break
        }
      }
    } finally {
      bulkVerifyIds.forEach((id) => {
        setLoadingActions((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
      setBulkVerifyIds(null)
      setSelectedIds(new Set())
    }
  }, [bulkVerifyIds, playError])

  const handleBulkReject = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return
    setBulkRejectIds(Array.from(ids))
    setRejectReason('')
    setRejectNotes('')
    setRejectModalOpen(true)
  }, [])

  const openMapWindow = useCallback(() => {
    const w = window.open('/map', 'bantayog-map', 'width=1200,height=900')
    setPopupBlocked(w === null)
  }, [])

  useKeyboardShortcuts([
    { key: 'm', handler: openMapWindow },
    {
      key: 'v',
      handler: () => {
        if (!selectedReportId) return
        const focused = reports.find((r) => r.id === selectedReportId)
        if (focused?.status !== 'new' && focused?.status !== 'awaiting_verify') return
        void handleVerify(selectedReportId)
      },
    },
    {
      key: 'v',
      shift: true,
      handler: () => {
        selectedIds.forEach((id) => {
          void handleVerify(id)
        })
      },
    },
    {
      key: 'r',
      handler: () => {
        if (!selectedReportId) return
        const focused = reports.find((r) => r.id === selectedReportId)
        if (focused?.status !== 'awaiting_verify') return
        handleReject(selectedReportId)
      },
    },
    {
      key: 'Escape',
      handler: () => {
        selectReport(null)
        setSelectedIds(new Set())
        setRejectModalOpen(false)
        setHelpModalOpen(false)
      },
    },
    {
      key: '?',
      handler: () => {
        if (rejectModalOpen) return
        if (bulkVerifyIds !== null) return
        setHelpModalOpen(true)
      },
    },
  ])

  const pendingCount = reports.filter((r) => r.status === 'awaiting_verify').length
  const activeCount = reports.filter((r) =>
    ACTIVE_REPORT_STATUSES.includes(r.status as ReportStatus),
  ).length

  const municipalData: MunicipalPerformance[] = useMemo(() => {
    const byMuni = new Map<string, Report[]>()
    reports.forEach((r) => {
      const mapped = mapReportDocToReportLoose(r as unknown as Record<string, unknown>)
      const key = mapped.municipality || 'Unknown'
      const list = byMuni.get(key) ?? []
      list.push(mapped)
      byMuni.set(key, list)
    })
    return Array.from(byMuni.entries()).map(([municipality, muniReports]) => ({
      municipality,
      activeIncidents: muniReports.filter((r) => ACTIVE_REPORT_STATUSES.includes(r.status)).length,
    }))
  }, [reports])

  const handleRowClick = useCallback(
    (report: Report) => {
      selectReport(report.id)
      setSuppressNextBroadcast(true)
      sendSync({ type: 'select:report', reportId: report.id, source: 'dashboard' })
    },
    [selectReport, sendSync, setSuppressNextBroadcast],
  )

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        <OfflineBanner error={error} />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner error={error} />
      <CommandHeader
        title="PDRRMO Camarines Norte"
        windowRole="dashboard"
        lastUpdatedAt={lastUpdatedAt}
        notificationCount={3}
        onOpenMap={openMapWindow}
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudio}
        onShowKeyboardShortcuts={() => {
          setHelpModalOpen(true)
        }}
        onSignOut={() => {
          void signOut()
        }}
      />
      <StatusBar activeIncidents={activeCount} avgResponseTime={12} pendingTriage={pendingCount} />
      <main className="flex-1 overflow-auto p-4">
        {actionError && (
          <div
            className="mb-4 border border-[var(--color-danger)] bg-[var(--color-danger)]/20 px-4 py-2 text-sm text-[var(--color-danger)]"
            role="alert"
          >
            {actionError}
            <button onClick={clearActionError} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}
        {popupBlocked && (
          <div
            className="mb-4 border border-[var(--color-warning)] bg-[var(--color-warning)]/15 px-4 py-2 text-sm text-[var(--color-text-primary)]"
            role="status"
            aria-label="Map window blocked"
          >
            Map window was blocked by your browser.{' '}
            <a href="/map" target="_blank" rel="noopener noreferrer" className="underline">
              Open map in a new tab
            </a>
            <button
              onClick={() => {
                setPopupBlocked(false)
              }}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
                Triage Queue
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {triageReports.length} report{triageReports.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] shadow-sm">
              <TriageQueueTable
                reports={triageReports.map((r) =>
                  mapReportDocToReportLoose(r as unknown as Record<string, unknown>),
                )}
                selectedIds={selectedIds}
                loadingIds={loadingActions}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onVerify={(id) => {
                  void handleVerify(id)
                }}
                onReject={(id) => {
                  handleReject(id)
                }}
                onBulkVerify={(ids) => {
                  handleBulkVerify(ids)
                }}
                onBulkReject={handleBulkReject}
                onDispatch={() => {
                  openMapWindow()
                }}
                onRowClick={handleRowClick}
              />
            </div>
            {trackingReports.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
                    Active &amp; Recent Incidents
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {trackingReports.length} report{trackingReports.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ActiveIncidentsTable
                  reports={trackingReports.map((r) =>
                    mapReportDocToReportLoose(r as unknown as Record<string, unknown>),
                  )}
                  onRowClick={handleRowClick}
                />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <AnomalyAlertPanel
              alerts={alerts
                .map(mapAlertDocToAnomalyAlert)
                .filter((a): a is AnomalyAlert => a !== null)}
              onDismiss={() => {
                /* TODO: wire dismissAnomaly callable */
              }}
            />
            <MunicipalPerformanceTable
              data={municipalData}
              onSelectMunicipality={(m) => {
                setSuppressNextBroadcast(true)
                sendSync({ type: 'select:municipality', municipalityId: m, source: 'dashboard' })
              }}
            />
            <TrendAnalysisPanel reports={reports} />
          </div>
        </div>
      </main>
      <ConfirmationModal
        open={rejectModalOpen}
        title="Reject Report"
        message="This will permanently remove the report from the queue. The citizen will be notified."
        confirmLabel="Reject"
        confirmVariant="danger"
        onConfirm={() => {
          void confirmReject()
        }}
        onCancel={() => {
          setRejectModalOpen(false)
        }}
      >
        <div className="mt-3 space-y-2">
          <label className="block text-sm text-[var(--color-text-secondary)]">
            Reason
            <select
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
              }}
              className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Select reason</option>
              <option value="obviously_false">Obviously False</option>
              <option value="duplicate">Duplicate</option>
              <option value="test_submission">Test Submission</option>
              <option value="insufficient_detail">Insufficient Detail</option>
            </select>
          </label>
          <label className="block text-sm text-[var(--color-text-secondary)]">
            Notes (optional)
            <textarea
              value={rejectNotes}
              onChange={(e) => {
                setRejectNotes(e.target.value)
              }}
              className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              rows={2}
            />
          </label>
        </div>
      </ConfirmationModal>
      <ConfirmationModal
        open={bulkVerifyIds !== null}
        title="Bulk Verify Reports"
        message={`This will verify ${String(bulkVerifyIds?.size ?? 0)} selected report(s). Continue?`}
        confirmLabel="Verify"
        confirmVariant="primary"
        onConfirm={() => {
          void confirmBulkVerify()
        }}
        onCancel={() => {
          setBulkVerifyIds(null)
        }}
      />
      <ConfirmationModal
        open={helpModalOpen}
        title="Keyboard Shortcuts"
        message="M — Open map window | V — Verify focused report | Shift+V — Verify selected | R — Reject focused | Escape — Clear selection | ? — Show this help"
        confirmLabel="Got it"
        confirmVariant="primary"
        onConfirm={() => {
          setHelpModalOpen(false)
        }}
        onCancel={() => {
          setHelpModalOpen(false)
        }}
      />
    </div>
  )
}
