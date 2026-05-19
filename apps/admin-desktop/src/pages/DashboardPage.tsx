import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { CommandHeader } from '../components/CommandHeader'
import { StatusBar } from '../components/StatusBar'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { TrendAnalysisPanel } from '../components/TrendAnalysisPanel'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { AnomalyAlertBanner } from '../components/AnomalyAlertBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { ActiveIncidentsTable } from '../components/ActiveIncidentsTable'
import { AllClearState } from '../components/AllClearState'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
import { HelpModal } from '../components/HelpModal'
import { SuccessBanner } from '../components/SuccessBanner'
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
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import type { Report, MunicipalPerformance, AnomalyAlert, ReportStatus } from '../types'

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
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [lastUpdatedAt] = useState(() => Date.now())
  const [bulkRejectIds, setBulkRejectIds] = useState<string[] | null>(null)
  const [bulkVerifyIds, setBulkVerifyIds] = useState<Set<string> | null>(null)
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [verifyTargetId, setVerifyTargetId] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }
    }
  }, [])

  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set())

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

  const showSuccess = useCallback((message: string) => {
    setActionSuccess(message)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => {
      setActionSuccess(null)
    }, 4000)
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

  const handleVerify = useCallback((id: string) => {
    setVerifyTargetId(id)
    setVerifyModalOpen(true)
  }, [])

  const confirmVerify = useCallback(
    async (id: string) => {
      setLoadingActions((prev) => new Set(prev).add(id))
      try {
        await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
        showSuccess('Report verified')
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
    [playError, showSuccess],
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
      showSuccess(ids.length === 1 ? 'Report rejected' : `${String(ids.length)} reports rejected`)
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
  }, [rejectTargetId, rejectReason, rejectNotes, playError, bulkRejectIds, showSuccess])

  const handleBulkVerify = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return
    setBulkVerifyIds(ids)
  }, [])

  const confirmBulkVerify = useCallback(async () => {
    if (!bulkVerifyIds) return
    let verifiedCount = 0
    bulkVerifyIds.forEach((id) => {
      setLoadingActions((prev) => new Set(prev).add(id))
    })
    try {
      for (const id of bulkVerifyIds) {
        try {
          await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
          verifiedCount += 1
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
      if (verifiedCount > 0) {
        showSuccess(
          verifiedCount === 1 ? '1 report verified' : `${String(verifiedCount)} reports verified`,
        )
      }
    }
  }, [bulkVerifyIds, playError, showSuccess])

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
        handleVerify(selectedReportId)
      },
    },
    {
      key: 'v',
      shift: true,
      handler: () => {
        if (selectedIds.size === 0) return
        handleBulkVerify(selectedIds)
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
        setVerifyModalOpen(false)
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

  const lastReportAt = useMemo(() => {
    if (reports.length === 0) return undefined
    const latest = reports.reduce((max, r) => {
      const raw = r as unknown as Record<string, unknown>
      const ts = raw.createdAt as number | undefined
      return ts !== undefined && ts > max ? ts : max
    }, 0)
    if (!latest) return undefined
    return new Date(latest).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }, [reports])

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

  const avgResponseTime = useMemo(() => {
    const verifiedReports = reports.filter(
      (r) => r.status === 'verified' || r.status === 'resolved',
    )
    if (verifiedReports.length === 0) return 0
    const { totalMs, countWithTimestamps } = verifiedReports.reduce(
      (acc, r) => {
        const raw = r as unknown as Record<string, unknown>
        const createdAt = raw.createdAt as number | undefined
        const updatedAt = raw.updatedAt as number | undefined
        if (createdAt === undefined || updatedAt === undefined) return acc
        return {
          totalMs: acc.totalMs + (updatedAt - createdAt),
          countWithTimestamps: acc.countWithTimestamps + 1,
        }
      },
      { totalMs: 0, countWithTimestamps: 0 },
    )
    if (countWithTimestamps === 0) return 0
    return Math.round(totalMs / countWithTimestamps / 60000)
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
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudio}
        onDeclareAlert={() => {
          setAlertModalOpen(true)
        }}
        onShowKeyboardShortcuts={() => {
          setHelpModalOpen(true)
        }}
        onSignOut={() => {
          void signOut()
        }}
      />
      <StatusBar
        activeIncidents={activeCount}
        avgResponseTime={avgResponseTime}
        pendingTriage={pendingCount}
      />
      <main className="flex-1 overflow-auto px-6 py-5">
        {actionSuccess && (
          <SuccessBanner
            message={actionSuccess}
            onDismiss={() => {
              setActionSuccess(null)
            }}
          />
        )}
        {actionError && <ActionErrorBanner message={actionError} onDismiss={clearActionError} />}
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
        <AnomalyAlertBanner
          alerts={alerts
            .map(mapAlertDocToAnomalyAlert)
            .filter((a): a is AnomalyAlert => a !== null)
            .filter((a) => !dismissedAlertIds.has(a.id))}
          onDismissAll={() => {
            setDismissedAlertIds((prev) => {
              const next = new Set(prev)
              alerts
                .map(mapAlertDocToAnomalyAlert)
                .filter((a): a is AnomalyAlert => a !== null)
                .forEach((a) => next.add(a.id))
              return next
            })
            try {
              // Attempt to call dismissAnomaly if it exists at runtime
              void (callables as Record<string, (...args: unknown[]) => unknown>).dismissAnomaly?.()
            } catch {
              // silently ignore — UI already updated
            }
          }}
        />

        {triageReports.length === 0 && trackingReports.length === 0 ? (
          <AllClearState lastReportAt={lastReportAt} />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0 space-y-8">
              <section>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
                    Triage Queue
                  </h2>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    {triageReports.length}
                  </span>
                </div>
                <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)]">
                  <TriageQueueTable
                    reports={triageReports.map((r) =>
                      mapReportDocToReportLoose(r as unknown as Record<string, unknown>),
                    )}
                    selectedIds={selectedIds}
                    loadingIds={loadingActions}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onVerify={(id) => {
                      handleVerify(id)
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
              </section>

              {trackingReports.length > 0 && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                      Active &amp; Recent Incidents
                    </h2>
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">
                      {trackingReports.length}
                    </span>
                  </div>
                  <ActiveIncidentsTable
                    reports={trackingReports.map((r) =>
                      mapReportDocToReportLoose(r as unknown as Record<string, unknown>),
                    )}
                    onRowClick={handleRowClick}
                  />
                </section>
              )}

              <section>
                <TrendAnalysisPanel reports={reports} />
              </section>
            </div>

            <aside className="min-w-0">
              <div className="mb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Municipalities
                </h2>
              </div>
              <MunicipalPerformanceTable
                data={municipalData}
                onSelectMunicipality={(m) => {
                  setSuppressNextBroadcast(true)
                  sendSync({ type: 'select:municipality', municipalityId: m, source: 'dashboard' })
                }}
              />
            </aside>
          </div>
        )}
      </main>
      <ConfirmationModal
        open={verifyModalOpen}
        title="Verify report?"
        message="This will mark the report as confirmed and make it visible to the public."
        confirmLabel="Verify"
        confirmVariant="primary"
        onConfirm={() => {
          if (verifyTargetId) {
            void confirmVerify(verifyTargetId)
          }
          setVerifyModalOpen(false)
          setVerifyTargetId(null)
        }}
        onCancel={() => {
          setVerifyModalOpen(false)
          setVerifyTargetId(null)
        }}
      />
      <ConfirmationModal
        open={rejectModalOpen}
        title="Reject report?"
        message="This will permanently remove the report from the queue. The reporter will be notified."
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
              <option value="obviously_false">Obviously false</option>
              <option value="duplicate">Duplicate</option>
              <option value="test_submission">Test submission</option>
              <option value="insufficient_detail">Insufficient detail</option>
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
        title="Verify reports?"
        message={`This will confirm ${String(bulkVerifyIds?.size ?? 0)} reports and make them visible to the public.`}
        confirmLabel="Verify"
        confirmVariant="primary"
        onConfirm={() => {
          void confirmBulkVerify()
        }}
        onCancel={() => {
          setBulkVerifyIds(null)
        }}
      />
      <HelpModal
        open={helpModalOpen}
        onClose={() => {
          setHelpModalOpen(false)
        }}
        shortcuts={[
          { key: 'M', description: 'Open map window' },
          { key: 'V', description: 'Verify focused report' },
          { key: 'Shift+V', description: 'Verify selected reports' },
          { key: 'R', description: 'Reject focused report' },
          { key: 'Esc', description: 'Clear selection' },
          { key: '?', description: 'Show this help' },
        ]}
      />
      <DeclareAlertModal
        open={alertModalOpen}
        onClose={() => {
          setAlertModalOpen(false)
        }}
        onSuccess={() => {
          setAlertModalOpen(false)
        }}
        onError={(msg) => {
          setActionError(msg)
        }}
      />
    </div>
  )
}
