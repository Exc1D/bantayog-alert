import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { CommandHeader } from '../components/CommandHeader'
import { StatusBar } from '../components/StatusBar'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { TrendAnalysisPanel } from '../components/TrendAnalysisPanel'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { AnomalyAlertPanel } from '../components/AnomalyAlertPanel'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useAudioAlerts } from '../hooks/useAudioAlerts'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import { callables } from '../services/callables'
import { db } from '../app/firebase'
import type { Report, MunicipalPerformance, AnomalyAlert } from '../types'

function generateIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`
  }
}

function mapReportDocToReport(doc: {
  id: string
  type: string
  severity: string
  municipality: string
  barangay: string
  createdAt: string
  status: string
  description: string
}): Report {
  return {
    id: doc.id,
    type: doc.type as Report['type'],
    severity: doc.severity as Report['severity'],
    municipality: doc.municipality,
    barangay: doc.barangay,
    createdAt: doc.createdAt,
    status: doc.status as Report['status'],
    description: doc.description,
    reporterName: '',
    reporterPhone: '',
    latitude: 0,
    longitude: 0,
    updatedAt: '',
  }
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

  const { selectReport, selectedReportId, setSuppressNextBroadcast } = useCommandCenterStore()
  const { loading, error, reports, reportOps, alerts } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })
  const { enabled: audioEnabled, toggle: toggleAudio, play, playError } = useAudioAlerts()
  const { sendSync, subscribe } = useWindowSyncContext()

  const prevIdsRef = useRef<Set<string>>(new Set())

  // Audio alert on new PENDING reports
  useEffect(() => {
    const currentPending = new Set(reports.filter((r) => r.status === 'PENDING').map((r) => r.id))
    const newArrivals = reports.filter(
      (r) => r.status === 'PENDING' && !prevIdsRef.current.has(r.id),
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

  const selectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === reports.length ? new Set() : new Set(reports.map((r) => r.id)),
    )
  }, [reports])

  const handleVerify = useCallback(
    async (id: string) => {
      try {
        await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Verify failed'
        setActionError(msg)
        playError()
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
    if (rejectTargetId && rejectReason) {
      try {
        const payload: {
          reportId: string
          reason: 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'
          idempotencyKey: string
          notes?: string
        } = {
          reportId: rejectTargetId,
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Reject failed'
        setActionError(msg)
        playError()
      }
    }
    setRejectModalOpen(false)
    setRejectTargetId(null)
  }, [rejectTargetId, rejectReason, rejectNotes, playError])

  const handleBulkVerify = useCallback(
    async (ids: Set<string>) => {
      for (const id of ids) {
        try {
          await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Bulk verify failed'
          setActionError(msg)
          playError()
          break
        }
      }
      setSelectedIds(new Set())
    },
    [playError],
  )

  const handleBulkReject = useCallback(
    (ids: Set<string>) => {
      if (ids.size > 0) {
        const first = Array.from(ids)[0]
        if (first) handleReject(first)
      }
      setSelectedIds(new Set())
    },
    [handleReject],
  )

  const openMapWindow = useCallback(() => {
    window.open('/map', 'bantayog-map', 'width=1200,height=900')
  }, [])

  useKeyboardShortcuts([
    { key: 'm', handler: openMapWindow },
    {
      key: 'v',
      handler: () => {
        if (selectedReportId) {
          void handleVerify(selectedReportId)
        }
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
        if (selectedReportId) {
          handleReject(selectedReportId)
        }
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
        setHelpModalOpen(true)
      },
    },
  ])

  const pendingCount = reports.filter((r) => r.status === 'PENDING').length
  const activeCount = reports.filter((r) => r.status === 'ACTIVE').length

  const municipalData: MunicipalPerformance[] = useMemo(() => {
    const byMuni = new Map<string, Report[]>()
    reports.forEach((r) => {
      const list = byMuni.get(r.municipality) ?? []
      list.push(mapReportDocToReport(r))
      byMuni.set(r.municipality, list)
    })
    return Array.from(byMuni.entries()).map(([municipality, muniReports]) => ({
      municipality,
      activeIncidents: muniReports.filter((r) => r.status === 'ACTIVE').length,
      activeResponders: 0,
      avgResponseTime: '0m',
      unresolvedOver24h: 0,
      adminOnDuty: false,
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
        lastUpdatedAt={lastUpdatedAt}
        notificationCount={3}
        onOpenMap={openMapWindow}
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudio}
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
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
          Triage Queue
        </h2>
        <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)]">
          <TriageQueueTable
            reports={reports.map(mapReportDocToReport)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onVerify={(id) => {
              void handleVerify(id)
            }}
            onReject={(id) => {
              handleReject(id)
            }}
            onBulkVerify={(ids) => {
              void handleBulkVerify(ids)
            }}
            onBulkReject={handleBulkReject}
            onDispatch={() => {
              openMapWindow()
            }}
            onRowClick={handleRowClick}
          />
        </div>
        <div className="mt-4">
          <MunicipalPerformanceTable
            data={municipalData}
            onSelectMunicipality={(m) => {
              setSuppressNextBroadcast(true)
              sendSync({ type: 'select:municipality', municipalityId: m, source: 'dashboard' })
            }}
          />
        </div>
        <div className="mt-4">
          <AnomalyAlertPanel
            alerts={alerts as AnomalyAlert[]}
            onDismiss={() => {
              /* TODO: wire dismiss callable */
            }}
          />
        </div>
        <div className="mt-4">
          <TrendAnalysisPanel reports={reports} reportOps={reportOps} responders={[]} />
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
