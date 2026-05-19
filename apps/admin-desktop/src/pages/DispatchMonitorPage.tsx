import { useState } from 'react'
import { useFirestore } from '../app/firebase'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { DispatchStatsCards } from '../components/DispatchStatsCards'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchLifecycleTable } from '../components/DispatchLifecycleTable'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { ReDispatchModal } from '../components/ReDispatchModal'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { callables } from '../services/callables'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'

export function DispatchMonitorPage() {
  const db = useFirestore()
  const { rows, loading, error } = useDispatchLifecycle(db)
  const { responders } = useResponderFleet(db)
  const { metrics: opsMetrics } = useOpsMetrics('24h')

  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  const stalledDispatches = rows.filter((r) => r.status === 'needs_admin')
  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length
  const avgAcceptSeconds = opsMetrics?.avgAcceptSeconds ?? null
  const fcmSuccessRate = opsMetrics?.fcmSuccessRate ?? 0

  const selectedRow = rows.find((r) => r.dispatchId === selectedDispatchId)
  const previouslyNotified = selectedRow?.previouslyNotifiedResponderUids ?? []

  const handleReDispatch = (dispatchId: string) => {
    setSelectedDispatchId(dispatchId)
    setIsModalOpen(true)
    setDispatchError(null)
  }

  const handleCloseModal = () => {
    setSelectedDispatchId(null)
    setIsModalOpen(false)
    setDispatchError(null)
  }

  const handleDispatch = async (responderUid: string, forceOverride?: true) => {
    if (!selectedDispatchId) return
    setIsDispatching(true)
    setDispatchError(null)
    try {
      await callables.escalateDispatch({
        dispatchId: selectedDispatchId,
        newResponderUid: responderUid,
        idempotencyKey: generateIdempotencyKey(),
        ...(forceOverride ? { forceOverride } : {}),
      })
      setIsModalOpen(false)
      setSelectedDispatchId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDispatchError(message)
    } finally {
      setIsDispatching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        <div className="flex flex-1 items-center justify-center">
          <div
            role="status"
            className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error && <ActionErrorBanner message={error} onDismiss={() => undefined} />}
        {dispatchError && (
          <ActionErrorBanner
            message={dispatchError}
            onDismiss={() => {
              setDispatchError(null)
            }}
          />
        )}

        <DispatchStatsCards
          activeCount={activeCount}
          stalledCount={stalledDispatches.length}
          avgAcceptSeconds={avgAcceptSeconds}
          fcmSuccessRate={fcmSuccessRate}
        />

        <EscalationQueueSection
          stalledDispatches={stalledDispatches.map((d) => ({
            dispatchId: d.dispatchId,
            reportId: d.reportId,
            responderName: d.responderName,
            escalationCount: d.escalationCount,
          }))}
          onReDispatch={handleReDispatch}
        />

        <DispatchLifecycleTable rows={rows} />

        <ResponderAvailabilityPanel responders={responders} />
      </div>

      <ReDispatchModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDispatch={(responderUid, forceOverride) => {
          void handleDispatch(responderUid, forceOverride)
        }}
        responders={responders}
        previouslyNotified={previouslyNotified}
        isLoading={isDispatching}
      />
    </div>
  )
}
