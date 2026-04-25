import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useMuniReports, type MuniReportRow } from '../hooks/useMuniReports'
import { ReportDetailPanel } from './ReportDetailPanel'
import { DispatchModal } from './DispatchModal'
import { CloseReportModal } from './CloseReportModal'
import { callables } from '../services/callables'
import { usePendingHandoffs } from '../hooks/usePendingHandoffs'
import { MassAlertModal } from './MassAlertModal'

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
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingReportId, setRejectingReportId] = useState<string | null>(null)
  const [acceptingHandoffId, setAcceptingHandoffId] = useState<string | null>(null)
  const [massAlertOpen, setMassAlertOpen] = useState(false)
  const { handoffs: pendingHandoffs, error: handoffsError } = usePendingHandoffs(municipalityId)
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (handoffModalOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [handoffModalOpen])

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

  const VALID_REJECT_REASONS = [
    'obviously_false',
    'duplicate',
    'test_submission',
    'insufficient_detail',
  ] as const

  const handleReject = (reportId: string) => {
    setRejectingReportId(reportId)
    setRejectReason('')
  }

  const confirmReject = async () => {
    if (!rejectingReportId) return
    if (!VALID_REJECT_REASONS.includes(rejectReason as (typeof VALID_REJECT_REASONS)[number])) {
      setBanner('Invalid reject reason')
      return
    }
    try {
      await callables.rejectReport({
        reportId: rejectingReportId,
        reason: rejectReason as (typeof VALID_REJECT_REASONS)[number],
        idempotencyKey: crypto.randomUUID(),
      })
      setRejectingReportId(null)
      setRejectReason('')
    } catch (err: unknown) {
      setBanner(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  const indexRef = useRef<number>(-1)
  const modalOpen = !!dispatchForReportId || !!closeForReportId || handoffModalOpen || massAlertOpen

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDispatchForReportId(null)
        setCloseForReportId(null)
        setHandoffModalOpen(false)
        setMassAlertOpen(false)
        return
      }
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
            void (async () => {
              try {
                await signOut()
              } catch (err: unknown) {
                setBanner(err instanceof Error ? err.message : 'Sign out failed')
              }
            })()
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
        <button
          onClick={() => {
            setMassAlertOpen(true)
          }}
        >
          Mass Alert
        </button>
      </header>
      {banner && <div role="alert">{banner}</div>}
      {handoffsError && <div role="alert">Handoffs error: {handoffsError}</div>}
      {pendingHandoffs.length > 0 && (
        <div role="alert" aria-label="incoming handoff">
          {pendingHandoffs.length} pending handoff(s) awaiting acceptance.
          {pendingHandoffs.map((h) => (
            <button
              key={h.id}
              disabled={acceptingHandoffId === h.id}
              onClick={() => {
                void (async () => {
                  setAcceptingHandoffId(h.id)
                  try {
                    await callables.acceptShiftHandoff({
                      handoffId: h.id,
                      idempotencyKey: crypto.randomUUID(),
                    })
                  } catch (err: unknown) {
                    setBanner(err instanceof Error ? err.message : 'Accept failed')
                  } finally {
                    setAcceptingHandoffId(null)
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
                {reports.map((r: MuniReportRow, i: number) => (
                  <li key={r.reportId}>
                    <button
                      onClick={() => {
                        setSelected(r.reportId)
                        indexRef.current = i
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
        {rejectingReportId ? (
          <div>
            <h3>Reject Report</h3>
            <label htmlFor="reject-reason">Reason</label>
            <select
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
              }}
            >
              <option value="">Select a reason...</option>
              <option value="obviously_false">Obviously False</option>
              <option value="duplicate">Duplicate</option>
              <option value="test_submission">Test Submission</option>
              <option value="insufficient_detail">Insufficient Detail</option>
            </select>
            <button
              onClick={() => {
                void confirmReject()
              }}
            >
              Confirm Reject
            </button>
            <button
              onClick={() => {
                setRejectingReportId(null)
                setRejectReason('')
              }}
            >
              Cancel
            </button>
          </div>
        ) : selected ? (
          <ReportDetailPanel
            reportId={selected}
            onVerify={handleVerify}
            onReject={handleReject}
            onDispatch={setDispatchForReportId}
            onClose={setCloseForReportId}
          />
        ) : null}
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
        <dialog
          ref={dialogRef}
          aria-label="Shift Handoff"
          onClose={() => {
            setHandoffModalOpen(false)
          }}
        >
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
      {massAlertOpen && municipalityId && (
        <MassAlertModal
          municipalityId={municipalityId}
          onClose={() => {
            setMassAlertOpen(false)
          }}
        />
      )}
    </main>
  )
}
