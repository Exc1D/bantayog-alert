import { useState, useCallback } from 'react'
import { CommandHeader } from '../components/CommandHeader'
import { ProvincialMap } from '../components/ProvincialMap'
import { TriagePanel } from '../components/TriagePanel'
import { OfflineBanner } from '../components/OfflineBanner'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import type { Report } from '../types'

export default function MapPage() {
  const { selectedReportId, selectReport, setLastSyncMessage } = useCommandCenterStore()
  const [reports] = useState<Report[]>([
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

  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? null

  const handlePinClick = useCallback(
    (reportId: string) => {
      selectReport(reportId)
    },
    [selectReport],
  )

  const handleVerify = useCallback(
    (id: string) => {
      setLastSyncMessage({
        type: 'triage:action',
        reportId: id,
        action: 'verified',
      })
    },
    [setLastSyncMessage],
  )

  const handleReject = useCallback(
    (id: string) => {
      setLastSyncMessage({
        type: 'triage:action',
        reportId: id,
        action: 'rejected',
      })
    },
    [setLastSyncMessage],
  )

  const handleDispatch = useCallback(
    (id: string) => {
      setLastSyncMessage({
        type: 'triage:action',
        reportId: id,
        action: 'dispatched',
      })
    },
    [setLastSyncMessage],
  )

  const [lastUpdatedAt] = useState(() => Date.now())

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner />
      <CommandHeader title="Provincial Map — Camarines Norte" lastUpdatedAt={lastUpdatedAt} />
      <div className="relative flex-1">
        <ProvincialMap
          reports={reports}
          selectedReportId={selectedReportId}
          onPinClick={handlePinClick}
        />
        <TriagePanel
          report={selectedReport}
          onClose={() => {
            selectReport(null)
          }}
          onVerify={handleVerify}
          onReject={handleReject}
          onDispatch={handleDispatch}
        />
      </div>
    </div>
  )
}
