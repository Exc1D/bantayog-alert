import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandHeader } from '../components/CommandHeader'
import { OfflineBanner } from '../components/OfflineBanner'
import { DispatchStatsCards } from '../components/DispatchStatsCards'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchVolumeChart } from '../components/DispatchVolumeChart'
import { RecentEventsFeed } from '../components/RecentEventsFeed'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { AllClearState } from '../components/AllClearState'
import { HelpModal } from '../components/HelpModal'
import { useAuth } from '@bantayog/shared-ui'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { db } from '../app/firebase'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import type { MunicipalPerformance, Report } from '../types'

export default function DashboardPage() {
  const { signOut } = useAuth()
  const { rows, loading: lifecycleLoading, error: lifecycleError } = useDispatchLifecycle(db)
  const { responders, loading: fleetLoading, error: fleetError } = useResponderFleet(db)
  const { metrics: opsMetrics, loading: metricsLoading, error: metricsError } = useOpsMetrics('24h')
  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
  } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })

  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [pageLoadedAt] = useState(() => Date.now())

  const isLoading = lifecycleLoading || fleetLoading || metricsLoading || reportsLoading
  const error = lifecycleError ?? fleetError ?? metricsError ?? reportsError

  const stalledDispatches = rows
    .filter((r) => r.status === 'needs_admin')
    .map((r) => ({
      dispatchId: r.dispatchId,
      reportId: r.reportId,
      responderName: r.responderName,
      escalationCount: r.escalationCount,
    }))

  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length

  const municipalData: MunicipalPerformance[] = useMemo(() => {
    const byMuni = new Map<string, Report[]>()
    reports.forEach((r) => {
      const mapped = mapReportDocToReportLoose(r)
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

  const navigate = useNavigate()

  // TODO [PR#151-followup]: wire to responder-selection modal; redispatchReport requires newResponderUid + idempotencyKey
  const handleReDispatch = useCallback((dispatchId: string) => {
    void dispatchId
  }, [])

  const handleSelectMunicipality = useCallback(
    (municipality: string) => {
      void navigate(`/map?municipality=${encodeURIComponent(municipality)}`)
    },
    [navigate],
  )

  useKeyboardShortcuts([
    {
      key: '?',
      handler: () => {
        setHelpModalOpen(true)
      },
    },
    {
      key: 'Escape',
      handler: () => {
        setHelpModalOpen(false)
      },
    },
  ])

  if (isLoading && rows.length === 0 && reports.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        <CommandHeader title="PDRRMO Camarines Norte" lastUpdatedAt={pageLoadedAt} />
        {error && <OfflineBanner error={error} />}
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <CommandHeader
        title="PDRRMO Camarines Norte"
        lastUpdatedAt={pageLoadedAt}
        windowRole="dashboard"
        onShowKeyboardShortcuts={() => {
          setHelpModalOpen(true)
        }}
        onSignOut={() => {
          void signOut()
        }}
      />
      {error && <OfflineBanner error={error} />}
      <main className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Operations Dashboard</h1>
        {rows.length === 0 && responders.length === 0 && reports.length === 0 ? (
          <AllClearState />
        ) : (
          <div className="space-y-4">
            <DispatchStatsCards
              activeCount={activeCount}
              stalledCount={stalledDispatches.length}
              avgAcceptSeconds={opsMetrics?.avgAcceptSeconds ?? null}
              fcmSuccessRate={opsMetrics?.fcmSuccessRate ?? 0}
            />
            <EscalationQueueSection
              stalledDispatches={stalledDispatches}
              onReDispatch={handleReDispatch}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
              <div className="space-y-4">
                <DispatchVolumeChart rows={rows} />
                <RecentEventsFeed rows={rows} />
              </div>
              <div className="space-y-4">
                <ResponderAvailabilityPanel responders={responders} />
                <MunicipalPerformanceTable
                  data={municipalData}
                  onSelectMunicipality={handleSelectMunicipality}
                />
              </div>
            </div>
          </div>
        )}
      </main>
      <HelpModal
        open={helpModalOpen}
        onClose={() => {
          setHelpModalOpen(false)
        }}
        shortcuts={[
          { key: '?', description: 'Show keyboard shortcuts' },
          { key: 'Esc', description: 'Close help' },
        ]}
      />
    </div>
  )
}
