import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useMuniReports, type MuniReportRow } from '../hooks/useMuniReports'
import { TriagePanel } from './TriagePanel'
import { DispatchModal } from './DispatchModal'
import { CloseReportModal } from './CloseReportModal'
import { callables } from '../services/callables'
import { usePendingHandoffs } from '../hooks/usePendingHandoffs'
import { MassAlertModal } from './MassAlertModal'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../app/firebase'

// Surge mode keyboard shortcut: pressing S (when no modal is open and
// surge mode is NOT active yet) activates surge mode.
// Once surge mode is active: V=verify, R=open-reject, S=skip-next,
// ArrowDown/ArrowUp=navigate, Escape=exit surge mode.

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#991b1b',
  high: '#92400e',
  medium: '#a73400',
  low: '#16a34a',
}

export function TriageQueuePage() {
  const { claims, signOut } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const uid = typeof claims?.uid === 'string' ? claims.uid : ''
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

  // Surge mode state
  const [surgeMode, setSurgeMode] = useState(false)
  const [surgeIndex, setSurgeIndex] = useState(0)
  const [surgeAnnouncement, setSurgeAnnouncement] = useState('')

  // Closed reports
  const [showClosed, setShowClosed] = useState(false)
  const [closedReports, setClosedReports] = useState<MuniReportRow[]>([])

  const { handoffs: pendingHandoffs, error: handoffsError } = usePendingHandoffs(municipalityId)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const indexRef = useRef<number>(-1)

  useEffect(() => {
    if (!municipalityId || !showClosed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClosedReports([])
      return
    }
    const q = query(
      collection(db, 'report_ops'),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'closed'),
      orderBy('createdAt', 'desc'),
      limit(20),
    )
    const unsub = onSnapshot(q, (snap) => {
      setClosedReports(
        snap.docs.map((d) => {
          const data = d.data()
          const row: MuniReportRow = {
            reportId: d.id,
            status: String(data.status) as MuniReportRow['status'],
            severity: String(data.severity ?? 'medium') as MuniReportRow['severity'],
            createdAt: data.createdAt as Timestamp,
            municipalityLabel: String(data.municipalityLabel ?? ''),
          }
          if (data.reportType !== undefined) row.reportType = String(data.reportType)
          if (data.duplicateClusterId !== undefined)
            row.duplicateClusterId = String(data.duplicateClusterId)
          if (data.barangayId !== undefined) row.barangayId = String(data.barangayId)
          return row
        }),
      )
    })
    return unsub
  }, [municipalityId, showClosed])

  useEffect(() => {
    if (handoffModalOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [handoffModalOpen])

  const VALID_REJECT_REASONS = [
    'obviously_false',
    'duplicate',
    'test_submission',
    'insufficient_detail',
  ] as const

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

  const canOpenMassAlert = typeof municipalityId === 'string' && municipalityId.trim().length > 0

  // Unverified reports for surge mode (status awaiting_verify or new)
  const surgeReports = reports.filter((r) => r.status === 'awaiting_verify' || r.status === 'new')

  const modalOpen =
    !!dispatchForReportId ||
    !!closeForReportId ||
    handoffModalOpen ||
    (massAlertOpen && canOpenMassAlert)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape always closes modals and exits surge mode
      if (e.key === 'Escape') {
        if (surgeMode) {
          setSurgeMode(false)
          setSurgeAnnouncement('Surge mode deactivated.')
          return
        }
        setDispatchForReportId(null)
        setCloseForReportId(null)
        setHandoffModalOpen(false)
        setMassAlertOpen(false)
        setSelected(null)
        return
      }

      if (modalOpen) return
      if (selected && !surgeMode) {
        // Standard mode j/k navigation
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
        return
      }

      if (!surgeMode) {
        // j/k navigation (standard mode, no panel open)
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
        } else if (e.key === 's' || e.key === 'S') {
          // Activate surge mode
          setSurgeMode(true)
          setSurgeIndex(0)
          setSurgeAnnouncement('Surge mode activated. Use V to verify, R to reject, S to skip.')
        }
        return
      }

      // Surge mode keyboard shortcuts
      const currentReport = surgeReports[surgeIndex]

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(surgeIndex + 1, surgeReports.length - 1)
        setSurgeIndex(next)
        const r = surgeReports[next]
        setSurgeAnnouncement(r ? `Highlighted: ${r.reportId.slice(0, 8)} — ${r.severity}` : '')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(surgeIndex - 1, 0)
        setSurgeIndex(prev)
        const r = surgeReports[prev]
        setSurgeAnnouncement(r ? `Highlighted: ${r.reportId.slice(0, 8)} — ${r.severity}` : '')
      } else if ((e.key === 'v' || e.key === 'V') && currentReport) {
        setSurgeAnnouncement(`Verifying ${currentReport.reportId.slice(0, 8)}…`)
        void (async () => {
          try {
            await callables.verifyReport({
              reportId: currentReport.reportId,
              idempotencyKey: crypto.randomUUID(),
            })
            setSurgeAnnouncement(`Verified ${currentReport.reportId.slice(0, 8)}.`)
            setSurgeIndex((i) => Math.min(i, Math.max(0, surgeReports.length - 2)))
          } catch (err: unknown) {
            setSurgeAnnouncement(
              `Verify failed: ${err instanceof Error ? err.message : 'unknown error'}`,
            )
          }
        })()
      } else if ((e.key === 'r' || e.key === 'R') && currentReport) {
        setRejectingReportId(currentReport.reportId)
        setSurgeAnnouncement(`Reject dialog opened for ${currentReport.reportId.slice(0, 8)}.`)
      } else if ((e.key === 'm' || e.key === 'M') && currentReport) {
        // Merge — placeholder: select for merge
        setSurgeAnnouncement(
          `Merge action: select duplicate for ${currentReport.reportId.slice(0, 8)}.`,
        )
      } else if ((e.key === 's' || e.key === 'S') && currentReport) {
        // Skip to next
        const next = Math.min(surgeIndex + 1, surgeReports.length - 1)
        setSurgeIndex(next)
        const r = surgeReports[next]
        setSurgeAnnouncement(r ? `Skipped. Now at ${r.reportId.slice(0, 8)}.` : 'No more reports.')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [modalOpen, reports, selected, surgeMode, surgeIndex, surgeReports])

  return (
    <main>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid #dfe3e8',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#001e40', flex: 1 }}>
          Triage · {municipalityId ?? 'N/A'}
        </h1>
        {/* Surge Mode toggle */}
        <button
          aria-label={surgeMode ? 'Exit Surge Mode' : 'Surge Mode'}
          aria-pressed={surgeMode}
          onClick={() => {
            setSurgeMode((m) => {
              const next = !m
              if (next) {
                setSurgeIndex(0)
                setSurgeAnnouncement(
                  'Surge mode activated. Use V to verify, R to reject, S to skip.',
                )
              } else {
                setSurgeAnnouncement('Surge mode deactivated.')
              }
              return next
            })
          }}
          style={{
            background: surgeMode ? '#92400e' : 'transparent',
            color: surgeMode ? '#ffffff' : '#001e40',
            border: '1px solid #92400e',
            borderRadius: 6,
            padding: '6px 12px',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            minHeight: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Surge Mode
          <kbd style={{ opacity: 0.7, fontSize: 10, fontFamily: 'monospace' }}>S</kbd>
        </button>
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
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #dfe3e8',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Sign out
        </button>
        <button
          onClick={() => {
            setHandoffModalOpen(true)
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #dfe3e8',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Start Handoff
        </button>
        <button
          onClick={() => {
            if (!canOpenMassAlert) {
              setBanner('Mass Alert is only available for municipality-scoped admins.')
              return
            }
            setMassAlertOpen(true)
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            background: '#a73400',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Mass Alert
        </button>
      </header>

      {/* Surge mode banner */}
      {surgeMode && (
        <div
          aria-label="Surge mode active"
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid #fde68a',
          }}
        >
          SURGE MODE ACTIVE
          <span style={{ fontWeight: 400 }}>
            {String(surgeReports.length)} unverified report{surgeReports.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 'auto' }}>
            V=verify · R=reject · M=merge · S=skip · ↑↓=navigate · Esc=exit
          </span>
        </div>
      )}

      {/* aria-live region for surge keyboard action announcements */}
      {surgeMode && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
          }}
        >
          {surgeAnnouncement}
        </div>
      )}

      {banner && (
        <div
          role="alert"
          style={{ padding: '8px 16px', background: '#fee2e2', color: '#991b1b', fontSize: 13 }}
        >
          {banner}
        </div>
      )}
      {handoffsError && (
        <div
          role="alert"
          style={{ padding: '8px 16px', background: '#fee2e2', color: '#991b1b', fontSize: 13 }}
        >
          Handoffs error: {handoffsError}
        </div>
      )}
      {pendingHandoffs.length > 0 && (
        <div
          role="alert"
          aria-label="incoming handoff"
          style={{
            padding: '8px 16px',
            background: '#fef3c7',
            borderBottom: '1px solid #fde68a',
            fontSize: 13,
          }}
        >
          {pendingHandoffs.length} pending handoff(s) awaiting acceptance.
          {pendingHandoffs.map((h) => (
            <button
              key={h.id}
              disabled={acceptingHandoffId === h.id}
              style={{
                marginLeft: 8,
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid #92400e',
                cursor: 'pointer',
                fontSize: 12,
              }}
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

      {surgeMode ? (
        // Dense surge mode list
        <section style={{ padding: '16px' }}>
          <ul
            aria-label="Surge queue"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {surgeReports.map((r, i) => {
              const highlighted = i === surgeIndex
              return (
                <li
                  key={r.reportId}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: highlighted ? '2px solid #001e40' : '1px solid #dfe3e8',
                    background: highlighted ? '#f0f4fa' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                  role="option"
                  onClick={() => {
                    setSurgeIndex(i)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSurgeIndex(i)
                  }}
                  aria-selected={highlighted}
                  tabIndex={highlighted ? 0 : -1}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: SEVERITY_COLOR[r.severity] ?? '#a73400',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#556068', textTransform: 'capitalize' }}>
                    {r.reportType ?? r.status}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: SEVERITY_COLOR[r.severity] ?? '#a73400',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      marginLeft: 'auto',
                    }}
                  >
                    {r.severity}
                  </span>
                  <span style={{ fontSize: 11, color: '#8a9199' }}>{r.municipalityLabel}</span>
                  {r.duplicateClusterId && (
                    <span
                      style={{
                        fontSize: 11,
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '1px 6px',
                        borderRadius: 999,
                      }}
                    >
                      dup
                    </span>
                  )}
                  {highlighted && (
                    <div style={{ marginLeft: 8, display: 'flex', gap: 4 }}>
                      <button
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: '#001e40',
                          color: '#fff',
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          void (async () => {
                            try {
                              await callables.verifyReport({
                                reportId: r.reportId,
                                idempotencyKey: crypto.randomUUID(),
                              })
                              setSurgeAnnouncement(`Verified ${r.reportId.slice(0, 8)}.`)
                            } catch (err: unknown) {
                              setBanner(err instanceof Error ? err.message : 'Verify failed')
                            }
                          })()
                        }}
                      >
                        V
                      </button>
                      <button
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: '#a73400',
                          color: '#fff',
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setRejectingReportId(r.reportId)
                          setRejectReason('')
                        }}
                      >
                        R
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
            {surgeReports.length === 0 && (
              <li style={{ padding: '16px', textAlign: 'center', color: '#556068', fontSize: 13 }}>
                No unverified reports.
              </li>
            )}
          </ul>

          {/* Inline reject dialog for surge mode */}
          {rejectingReportId && (
            <div
              style={{
                marginTop: 16,
                border: '1px solid #a73400',
                borderRadius: 8,
                padding: '16px',
                background: '#fff7f5',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#a73400' }}>
                Reject Report {rejectingReportId.slice(0, 8)}
              </h3>
              <label
                htmlFor="surge-reject-reason"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#556068',
                  marginBottom: 4,
                }}
              >
                Reason
              </label>
              <select
                id="surge-reject-reason"
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value)
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #dfe3e8',
                  fontSize: 13,
                  marginBottom: 10,
                  minHeight: 44,
                }}
              >
                <option value="">Select a reason...</option>
                <option value="obviously_false">Obviously False</option>
                <option value="duplicate">Duplicate</option>
                <option value="test_submission">Test Submission</option>
                <option value="insufficient_detail">Insufficient Detail</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    void confirmReject()
                  }}
                  style={{
                    background: '#a73400',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => {
                    setRejectingReportId(null)
                    setRejectReason('')
                  }}
                  style={{
                    background: 'transparent',
                    color: '#556068',
                    border: '1px solid #dfe3e8',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        // Standard split view
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: selected ? '1fr' : '1fr',
            gap: 16,
            padding: '16px',
            position: 'relative',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#001e40' }}>
              Queue
            </h2>
            {loading ? (
              <p style={{ color: '#556068', fontSize: 14 }}>Loading…</p>
            ) : error ? (
              <p role="alert" style={{ color: '#991b1b', fontSize: 14 }}>
                Error: {error}
              </p>
            ) : reports.length === 0 ? (
              <p style={{ color: '#556068', fontSize: 14 }}>No active reports.</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#556068', marginBottom: 8 }}>
                  Showing {reports.length}
                  {hasMore ? '+' : ''} reports
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {reports.map((r: MuniReportRow, i: number) => (
                    <li key={r.reportId}>
                      <button
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border:
                            selected === r.reportId ? '2px solid #001e40' : '1px solid #dfe3e8',
                          background: selected === r.reportId ? '#f0f4fa' : '#ffffff',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
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
                {hasMore && (
                  <button
                    onClick={loadMore}
                    style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #dfe3e8',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Load More
                  </button>
                )}
              </>
            )}
          </div>

          {/* Inline reject dialog (standard mode) */}
          {rejectingReportId && (
            <div
              style={{
                marginTop: 16,
                border: '1px solid #a73400',
                borderRadius: 8,
                padding: '16px',
                background: '#fff7f5',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#a73400' }}>
                Reject Report
              </h3>
              <label
                htmlFor="reject-reason"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#556068',
                  marginBottom: 4,
                }}
              >
                Reason
              </label>
              <select
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value)
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #dfe3e8',
                  fontSize: 13,
                  marginBottom: 10,
                  minHeight: 44,
                }}
              >
                <option value="">Select a reason...</option>
                <option value="obviously_false">Obviously False</option>
                <option value="duplicate">Duplicate</option>
                <option value="test_submission">Test Submission</option>
                <option value="insufficient_detail">Insufficient Detail</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    void confirmReject()
                  }}
                  style={{
                    background: '#a73400',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => {
                    setRejectingReportId(null)
                    setRejectReason('')
                  }}
                  style={{
                    background: 'transparent',
                    color: '#556068',
                    border: '1px solid #dfe3e8',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Closed reports toggle */}
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => {
                setShowClosed((s) => !s)
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #dfe3e8',
                cursor: 'pointer',
                fontSize: 13,
                background: showClosed ? '#f0f4f8' : '#ffffff',
              }}
            >
              {showClosed ? 'Hide' : 'Show'} Closed Reports
            </button>
          </div>

          {showClosed && (
            <div style={{ marginTop: 12 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#001e40' }}>
                Closed Reports
              </h2>
              {closedReports.length === 0 ? (
                <p style={{ color: '#556068', fontSize: 14 }}>No closed reports.</p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {closedReports.map((r: MuniReportRow) => (
                    <li key={r.reportId}>
                      <button
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border:
                            selected === r.reportId ? '2px solid #001e40' : '1px solid #dfe3e8',
                          background: selected === r.reportId ? '#f0f4fa' : '#ffffff',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                        onClick={() => {
                          setSelected(r.reportId)
                        }}
                      >
                        [closed] {r.severity} — {r.reportId.slice(0, 8)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* Slide-in TriagePanel when a report is selected (standard mode only) */}
      {selected && !surgeMode && municipalityId && (
        <TriagePanel
          reportId={selected}
          currentUserUid={uid}
          municipalityId={municipalityId}
          onClose={() => {
            setSelected(null)
          }}
          onDispatch={setDispatchForReportId}
          onCloseReport={setCloseForReportId}
        />
      )}

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
