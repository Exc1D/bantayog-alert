import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useMuniReports, type MuniReportRow } from '../hooks/useMuniReports'
import { ReportDetailPanel } from './ReportDetailPanel'
import { DispatchModal } from './DispatchModal'
import { CloseReportModal } from './CloseReportModal'
import { callables } from '../services/callables'
import { usePendingHandoffs } from '../hooks/usePendingHandoffs'

export function TriageQueuePage() {
  const { claims, signOut } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const { reports, hasMore, loadMore, loading, error } = useMuniReports(municipalityId)
  const [selected, setSelected] = useState<string | null>(null)
  const [dispatchForReportId, setDispatchForReportId] = useState<string | null>(null)
  const [closeForReportId, setCloseForReportId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [handoffModalOpen, setHandoffModalOpen] = useState(false)
  const [handoffNotes, setHandoffNotes] = useState('')
  const [handoffLoading, setHandoffLoading] = useState(false)
  const pendingHandoffs = usePendingHandoffs(municipalityId)

  const handleVerify = (reportId: string) => {
    void (async () => {
      try {
        await callables.verifyReport({ reportId, idempotencyKey: crypto.randomUUID() })
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Verify failed')
      }
    })()
  }

  const handleReject = (reportId: string) => {
    const reason = prompt(
      'Reject reason (obviously_false, duplicate, test_submission, insufficient_detail)?',
    )
    if (!reason) return
    void (async () => {
      try {
        await callables.rejectReport({
          reportId,
          reason: reason as
            | 'obviously_false'
            | 'duplicate'
            | 'test_submission'
            | 'insufficient_detail',
          idempotencyKey: crypto.randomUUID(),
        })
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Reject failed')
      }
    })()
  }

  const indexRef = useRef<number>(-1)
  const modalOpen = !!dispatchForReportId || !!closeForReportId

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen) return
      if (e.key === 'j') {
        const next = Math.min(indexRef.current + 1, reports.length - 1)
        if (next >= 0) {
          indexRef.current = next
          setSelected(reports[next]?.reportId ?? null)
        }
      } else if (e.key === 'k') {
        const prev = Math.max(indexRef.current - 1, 0)
        if (prev >= 0 && reports.length > 0) {
          indexRef.current = prev
          setSelected(reports[prev]?.reportId ?? null)
        }
      } else if (e.key === 'Escape') {
        setDispatchForReportId(null)
        setCloseForReportId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [modalOpen, reports])

  return (
    <main>
      <header>
        <h1>Triage · {municipalityId ?? 'N/A'}</h1>
        <button
          onClick={() => {
            void signOut()
          }}
        >
          Sign out
        </button>
        <button
          onClick={() => {
            setHandoffModalOpen(true)
          }}
        >
          Start Handoff
        </button>
      </header>
      {banner && <div role="alert">{banner}</div>}
      {pendingHandoffs.length > 0 && (
        <div role="banner" aria-label="incoming handoff">
          {pendingHandoffs.length} pending handoff(s) awaiting acceptance.
          {pendingHandoffs.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                void (async () => {
                  try {
                    await callables.acceptShiftHandoff({
                      handoffId: h.id,
                      idempotencyKey: crypto.randomUUID(),
                    })
                  } catch (err: unknown) {
                    setBanner(err instanceof Error ? err.message : 'Accept failed')
                  }
                })()
              }}
            >
              Accept Handoff
            </button>
          ))}
        </div>
      )}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2>Queue</h2>
          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p role="alert">Error: {error}</p>
          ) : reports.length === 0 ? (
            <p>No active reports.</p>
          ) : (
            <>
              <p>
                Showing {reports.length}
                {hasMore ? '+' : ''} reports
              </p>
              <ul>
                {reports.map((r: MuniReportRow) => (
                  <li key={r.reportId}>
                    <button
                      onClick={() => {
                        setSelected(r.reportId)
                      }}
                    >
                      [{r.status}] {r.severity}
                      {r.duplicateClusterId ? ' [dup]' : ''} — {r.reportId.slice(0, 8)}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && <button onClick={loadMore}>Load More</button>}
            </>
          )}
        </div>
        {selected && (
          <ReportDetailPanel
            reportId={selected}
            onVerify={handleVerify}
            onReject={handleReject}
            onDispatch={setDispatchForReportId}
            onClose={setCloseForReportId}
          />
        )}
      </section>
      {dispatchForReportId && (
        <DispatchModal
          reportId={dispatchForReportId}
          onClose={() => {
            setDispatchForReportId(null)
          }}
          onError={(msg: string) => {
            setBanner(msg)
          }}
        />
      )}
      {closeForReportId && (
        <CloseReportModal
          reportId={closeForReportId}
          onClose={() => {
            setCloseForReportId(null)
          }}
          onError={(msg: string) => {
            setBanner(msg)
          }}
        />
      )}
      {handoffModalOpen && (
        <dialog open aria-label="Shift Handoff" aria-modal="true">
          <h3>Initiate Shift Handoff</h3>
          <label htmlFor="handoff-notes">Notes</label>
          <textarea
            id="handoff-notes"
            value={handoffNotes}
            onChange={(e) => {
              setHandoffNotes(e.target.value)
            }}
            rows={4}
          />
          <button
            disabled={handoffLoading}
            onClick={() => {
              setHandoffLoading(true)
              void (async () => {
                try {
                  await callables.initiateShiftHandoff({
                    notes: handoffNotes,
                    activeIncidentIds: [],
                    idempotencyKey: crypto.randomUUID(),
                  })
                  setHandoffModalOpen(false)
                  setHandoffNotes('')
                } catch (err: unknown) {
                  setBanner(err instanceof Error ? err.message : 'Handoff failed')
                } finally {
                  setHandoffLoading(false)
                }
              })()
            }}
          >
            Initiate
          </button>
          <button
            onClick={() => {
              setHandoffModalOpen(false)
            }}
          >
            Cancel
          </button>
        </dialog>
      )}
    </main>
  )
}
