import { useState, useCallback } from 'react'
import { CommandHeader } from '../components/CommandHeader'
import { StatusBar } from '../components/StatusBar'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import type { Report } from '../types'

export default function DashboardPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [lastUpdatedAt] = useState(() => Date.now())
  const { selectReport, selectedReportId, setLastSyncMessage } = useCommandCenterStore()

  const [reports] = useState<Report[]>([
    // Mock data for now; will be replaced with Firestore subscription
    {
      id: 'r1',
      type: 'FLOOD',
      severity: 'HIGH',
      municipality: 'Daet',
      barangay: 'Camambugan',
      createdAt: '14:02',
      status: 'PENDING',
      description: 'Water rising',
      reporterName: 'Juan',
      reporterPhone: '0917xxx',
      latitude: 14.1,
      longitude: 122.9,
      updatedAt: '',
    },
    {
      id: 'r2',
      type: 'FIRE',
      severity: 'MEDIUM',
      municipality: 'Labo',
      barangay: 'San Roque',
      createdAt: '14:08',
      status: 'PENDING',
      description: 'House fire',
      reporterName: 'Maria',
      reporterPhone: '0918xxx',
      latitude: 14.0,
      longitude: 122.8,
      updatedAt: '',
    },
  ])

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
    (id: string) => {
      setLastSyncMessage({ type: 'triage:action', reportId: id, action: 'verified' })
      // TODO: Call verifyReport callable
    },
    [setLastSyncMessage],
  )

  const handleReject = useCallback((id: string) => {
    setRejectTargetId(id)
    setRejectModalOpen(true)
  }, [])

  const confirmReject = useCallback(() => {
    if (rejectTargetId) {
      setLastSyncMessage({
        type: 'triage:action',
        reportId: rejectTargetId,
        action: 'rejected',
      })
      // TODO: Call rejectReport callable
    }
    setRejectModalOpen(false)
    setRejectTargetId(null)
  }, [rejectTargetId, setLastSyncMessage])

  const handleBulkVerify = useCallback(
    (ids: Set<string>) => {
      ids.forEach((id) => {
        setLastSyncMessage({
          type: 'triage:action',
          reportId: id,
          action: 'verified',
        })
      })
      setSelectedIds(new Set())
    },
    [setLastSyncMessage],
  )

  const handleBulkReject = useCallback(
    (ids: Set<string>) => {
      // For now, set sync message for each; in production this would call a bulk endpoint
      ids.forEach((id) => {
        setLastSyncMessage({
          type: 'triage:action',
          reportId: id,
          action: 'rejected',
        })
      })
      setSelectedIds(new Set())
    },
    [setLastSyncMessage],
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
          handleVerify(selectedReportId)
        }
      },
    },
    {
      key: 'v',
      shift: true,
      handler: () => {
        selectedIds.forEach((id) => {
          handleVerify(id)
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

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner />
      <CommandHeader
        title="PDRRMO Camarines Norte"
        lastUpdatedAt={lastUpdatedAt}
        notificationCount={3}
        onOpenMap={openMapWindow}
      />
      <StatusBar
        activeIncidents={reports.filter((r) => r.status === 'PENDING').length}
        avgResponseTime={0}
        pendingTriage={reports.length}
        resolvedToday={0}
        municipalitiesWithIssues={{
          withIssues: new Set(reports.map((r) => r.municipality)).size,
          total: 12,
        }}
      />
      <main className="flex-1 overflow-auto p-4">
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
          Triage Queue
        </h2>
        <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)]">
          <TriageQueueTable
            reports={reports}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onVerify={handleVerify}
            onReject={handleReject}
            onBulkVerify={handleBulkVerify}
            onBulkReject={handleBulkReject}
            onDispatch={() => {
              /* Dashboard dispatch opens map */
            }}
            onRowClick={(report) => {
              selectReport(report.id)
            }}
          />
        </div>
      </main>
      <ConfirmationModal
        open={rejectModalOpen}
        title="Reject Report"
        message="This will permanently remove the report from the queue. The citizen will be notified."
        confirmLabel="Reject"
        confirmVariant="danger"
        onConfirm={confirmReject}
        onCancel={() => {
          setRejectModalOpen(false)
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
