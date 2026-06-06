import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFirestoreInstance } from '../app/firebase'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useAuth } from '@bantayog/shared-ui'
import { CommandHeader } from '../components/CommandHeader'
import { DispatchStatsCards } from '../components/DispatchStatsCards'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchLifecycleTable } from '../components/DispatchLifecycleTable'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { ReDispatchModal } from '../components/ReDispatchModal'
import { OfflineBanner } from '../components/OfflineBanner'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { HelpModal } from '../components/HelpModal'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
import { callables } from '../services/callables'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'

export function DispatchMonitorPage() {
  const db = getFirestoreInstance()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { rows, loading, error } = useDispatchLifecycle(db)
  const { responders } = useResponderFleet(db)
  const { metrics: opsMetrics } = useOpsMetrics('24h')

  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [creatingResponder, setCreatingResponder] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const highlightDispatchId = searchParams.get('highlight')

  const stalledDispatches = rows.filter((r) => r.status === 'needs_admin')
  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length
  const avgAcceptSeconds = opsMetrics?.avgAcceptSeconds ?? null
  const fcmSuccessRate = opsMetrics?.fcmSuccessRate ?? 0

  const selectedRow = rows.find((r) => r.dispatchId === selectedDispatchId)
  const previouslyNotified = selectedRow?.previouslyNotifiedResponderUids ?? []

  // Track data freshness
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loading) {
      setLastDataUpdateAt(Date.now())
    }
  }, [loading, rows.length, responders.length])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clock for stale indicator
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 60000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const isStale = now - lastDataUpdateAt > 5 * 60 * 1000
  const staleMinutes = isStale ? Math.round((now - lastDataUpdateAt) / 60000) : 0

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
      await withRetry(() =>
        callables.escalateDispatch({
          dispatchId: selectedDispatchId,
          newResponderUid: responderUid,
          idempotencyKey: generateIdempotencyKey(),
          ...(forceOverride ? { forceOverride } : {}),
        }),
      )
      setSuccessMessage('Re-dispatched successfully')
      setIsModalOpen(false)
      setSelectedDispatchId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDispatchError(message)
    } finally {
      setIsDispatching(false)
    }
  }

  const handleCreateResponder = async (input: {
    displayName: string
    phone: string
    agencyId: string
    municipalityId?: string
    specializations?: string[]
  }) => {
    setCreatingResponder(true)
    setDispatchError(null)
    const idempotencyKey = generateIdempotencyKey()
    try {
      await withRetry(() =>
        callables.createResponder({
          ...input,
          idempotencyKey,
        }),
      )
      setSuccessMessage('Responder account created')
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Responder account creation failed')
    } finally {
      setCreatingResponder(false)
    }
  }

  useKeyboardShortcuts([
    {
      key: 'r',
      handler: () => {
        const first = document.querySelector<HTMLElement>('[aria-label^="Re-dispatch"]')
        first?.focus()
      },
    },
    {
      key: 'd',
      handler: () => {
        void navigate('/dispatches')
      },
    },
    {
      key: 'f',
      handler: () => {
        void navigate('/feed')
      },
    },
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

  if (loading && rows.length === 0) {
    return (
      <>
        {error && (
          <OfflineBanner
            error={error}
            onRetry={() => {
              window.location.reload()
            }}
          />
        )}
        <PageSkeleton variant="dispatch" />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <a
        href="#main-content"
        className="sr-only rounded bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Skip to main content
      </a>

      {error && (
        <OfflineBanner
          error={error}
          onRetry={() => {
            window.location.reload()
          }}
        />
      )}
      <CommandHeader
        title="PDRRMO Camarines Norte"
        windowRole="dispatches"
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
      {successMessage && (
        <SuccessBanner
          message={successMessage}
          onDismiss={() => {
            setSuccessMessage(null)
          }}
        />
      )}
      {dispatchError && (
        <ActionErrorBanner
          message={dispatchError}
          onDismiss={() => {
            setDispatchError(null)
          }}
        />
      )}
      {isStale && !error && (
        <div
          className="flex items-center justify-center gap-2 bg-[var(--color-warning)]/20 px-4 py-1.5 text-xs text-[var(--color-warning)]"
          role="status"
        >
          Data may be stale · last update {staleMinutes}m ago
        </div>
      )}

      <main id="main-content" className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Dispatch Monitor</h1>
        <div className="space-y-4">
          <DispatchStatsCards
            activeCount={activeCount}
            stalledCount={stalledDispatches.length}
            avgAcceptSeconds={avgAcceptSeconds}
            fcmSuccessRate={fcmSuccessRate}
            mode={stalledDispatches.length > 0 ? 'active' : 'calm'}
          />

          <EscalationQueueSection
            stalledDispatches={stalledDispatches.map((d) => ({
              dispatchId: d.dispatchId,
              reportId: d.reportId,
              responderName: d.responderName,
              escalationCount: d.escalationCount,
            }))}
            onReDispatch={handleReDispatch}
            mode={stalledDispatches.length > 0 ? 'active' : 'calm'}
          />

          <DispatchLifecycleTable rows={rows} highlightDispatchId={highlightDispatchId} />

          <ResponderAvailabilityPanel
            responders={responders}
            onCreateResponder={handleCreateResponder}
            creatingResponder={creatingResponder}
          />
        </div>
      </main>

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

      <HelpModal
        open={helpModalOpen}
        onClose={() => {
          setHelpModalOpen(false)
        }}
        shortcuts={[
          { key: 'R', description: 'Focus first Re-dispatch button' },
          { key: 'D', description: 'Navigate to Dispatch Monitor' },
          { key: 'F', description: 'Navigate to Feed' },
          { key: '?', description: 'Show keyboard shortcuts' },
          { key: 'Esc', description: 'Close help' },
        ]}
      />
      <DeclareAlertModal
        open={alertModalOpen}
        onClose={() => {
          setAlertModalOpen(false)
        }}
        onSuccess={() => {
          setAlertModalOpen(false)
          setSuccessMessage('Alert declared successfully')
        }}
        onError={(msg) => {
          setDispatchError(msg)
        }}
      />
    </div>
  )
}
