// TriagePanel.tsx — slide-in triage panel for municipal admin report actions.
// Spec: §3.3 of municipal-admin-role-spec-v2.md
// Slides in from the right with transform/translateX, 200ms ease.
// Focus is trapped on open. Escape or X button closes.
import { useEffect, useRef, useState } from 'react'
import { X, Shield, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react'
import { useReportDetail } from '../hooks/useReportDetail'
import { useAgencies } from '../hooks/useAgencies'
import { callables } from '../services/callables'
import { CommandChannelPanel } from '../components/CommandChannelPanel'

type RejectReason = 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'

interface AgencyForm {
  agencyId: string
  requestType: string
  priority: 'routine' | 'urgent' | 'emergency'
  message: string
}

interface Props {
  reportId: string
  currentUserUid: string
  municipalityId: string
  onClose: () => void
  onDispatch: (reportId: string) => void
  onCloseReport: (reportId: string) => void
}

const SEVERITY_STYLE: Record<string, { bg: string; fg: string }> = {
  critical: { bg: '#fee2e2', fg: '#991b1b' },
  high: { bg: '#fef3c7', fg: '#92400e' },
  medium: { bg: '#fff7ed', fg: '#a73400' },
  low: { bg: '#dcfce7', fg: '#16a34a' },
}

const REQUEST_TYPES = [
  { value: 'medical', label: 'Medical' },
  { value: 'fire', label: 'Fire' },
  { value: 'police', label: 'Police' },
  { value: 'rescue', label: 'Rescue' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'social_welfare', label: 'Social Welfare' },
]

const REJECT_REASONS: { value: RejectReason; label: string }[] = [
  { value: 'obviously_false', label: 'Obviously False' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'test_submission', label: 'Test Submission' },
  { value: 'insufficient_detail', label: 'Insufficient Detail' },
]

export function TriagePanel({
  reportId,
  currentUserUid,
  municipalityId,
  onClose,
  onDispatch,
  onCloseReport,
}: Props) {
  const { report, ops, error } = useReportDetail(reportId)
  const agencies = useAgencies(municipalityId)
  const panelRef = useRef<HTMLDivElement>(null)

  // UI state
  const [actionBanner, setActionBanner] = useState<{
    type: 'error' | 'success'
    msg: string
  } | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState<RejectReason | ''>('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [agencyForm, setAgencyForm] = useState<AgencyForm>({
    agencyId: '',
    requestType: '',
    priority: 'routine',
    message: '',
  })
  const [agencyLoading, setAgencyLoading] = useState(false)

  // Focus trap: move focus into panel on mount, restore on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  // Keyboard trap inside panel.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      if (!panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const handleVerify = () => {
    setVerifyLoading(true)
    setActionBanner(null)
    void (async () => {
      try {
        await callables.verifyReport({ reportId, idempotencyKey: crypto.randomUUID() })
        setActionBanner({ type: 'success', msg: 'Report verified.' })
      } catch (err: unknown) {
        setActionBanner({
          type: 'error',
          msg: err instanceof Error ? err.message : 'Verify failed',
        })
      } finally {
        setVerifyLoading(false)
      }
    })()
  }

  const handleConfirmReject = () => {
    if (!rejectReason) return
    setRejectLoading(true)
    setActionBanner(null)
    void (async () => {
      try {
        await callables.rejectReport({
          reportId,
          reason: rejectReason,
          ...(rejectNotes ? { notes: rejectNotes } : {}),
          idempotencyKey: crypto.randomUUID(),
        })
        setActionBanner({ type: 'success', msg: 'Report rejected.' })
        setRejectOpen(false)
      } catch (err: unknown) {
        setActionBanner({
          type: 'error',
          msg: err instanceof Error ? err.message : 'Reject failed',
        })
      } finally {
        setRejectLoading(false)
      }
    })()
  }

  const handleSendAgencyRequest = () => {
    if (!agencyForm.agencyId || !agencyForm.requestType || !agencyForm.message.trim()) return
    setAgencyLoading(true)
    setActionBanner(null)
    void (async () => {
      try {
        await callables.requestAgencyAssistance({
          reportId,
          agencyId: agencyForm.agencyId,
          requestType: agencyForm.requestType,
          priority: agencyForm.priority,
          message: agencyForm.message.trim(),
          idempotencyKey: crypto.randomUUID(),
        })
        setActionBanner({ type: 'success', msg: 'Agency assistance requested.' })
        setAgencyOpen(false)
      } catch (err: unknown) {
        setActionBanner({
          type: 'error',
          msg: err instanceof Error ? err.message : 'Agency request failed',
        })
      } finally {
        setAgencyLoading(false)
      }
    })()
  }

  const canVerify = report?.status === 'new' || report?.status === 'awaiting_verify'
  const canReject = report?.status === 'awaiting_verify'
  const canDispatch = report?.status === 'verified'
  const canClose = report?.status === 'resolved'

  const severityKey = report?.severityDerived.toLowerCase() ?? 'medium'
  const severityStyle = SEVERITY_STYLE[severityKey] ??
    SEVERITY_STYLE.medium ?? { bg: '#e5e7eb', text: '#374151' }

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      {/* Slide-in panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Report triage panel"
        aria-modal="true"
        style={{
          width: '480px',
          maxWidth: '100vw',
          height: '100%',
          background: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'triagePanelSlideIn 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        {/* Panel header */}
        <div
          style={{
            background: '#001e40',
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <Shield style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
            Report {reportId.slice(0, 8)}
          </span>
          <button
            aria-label="Close panel"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              minWidth: 44,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {error && (
            <div
              role="alert"
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
          {actionBanner && (
            <div
              role={actionBanner.type === 'error' ? 'alert' : 'status'}
              style={{
                background: actionBanner.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: actionBanner.type === 'error' ? '#991b1b' : '#16a34a',
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {actionBanner.msg}
            </div>
          )}

          {!report ? (
            <p style={{ color: '#556068', fontSize: 14 }}>Loading…</p>
          ) : (
            <>
              {/* Summary card */}
              <div
                style={{
                  border: '1px solid #dfe3e8',
                  borderRadius: 8,
                  padding: '16px',
                  marginBottom: 16,
                  background: '#f6f7f9',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Severity badge */}
                  <span
                    style={{
                      background: severityStyle.bg,
                      color: 'fg' in severityStyle ? severityStyle.fg : severityStyle.text,
                      fontWeight: 600,
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {report.severityDerived}
                  </span>
                  {/* Report type */}
                  <span style={{ fontSize: 13, color: '#556068', textTransform: 'capitalize' }}>
                    {typeof (report as unknown as Record<string, unknown>).reportType === 'string'
                      ? ((report as unknown as Record<string, unknown>).reportType as string)
                      : 'Unknown type'}
                  </span>
                  {/* Witnessed badge */}
                  {(report as unknown as Record<string, unknown>).witnessedByResponder === true && (
                    <span
                      style={{
                        background: '#001e40',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle style={{ width: 11, height: 11 }} />
                      Responder-Witnessed
                    </span>
                  )}
                </div>
                <dl
                  style={{
                    margin: 0,
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: 12,
                    rowGap: 4,
                    fontSize: 13,
                  }}
                >
                  <dt style={{ color: '#556068', fontWeight: 500 }}>Location</dt>
                  <dd style={{ margin: 0 }}>{report.municipalityLabel}</dd>
                  <dt style={{ color: '#556068', fontWeight: 500 }}>Status</dt>
                  <dd style={{ margin: 0 }}>{report.status}</dd>
                  <dt style={{ color: '#556068', fontWeight: 500 }}>Submitted</dt>
                  <dd style={{ margin: 0 }}>{report.createdAt.toDate().toLocaleString()}</dd>
                  {ops && (
                    <>
                      <dt style={{ color: '#556068', fontWeight: 500 }}>Queue priority</dt>
                      <dd style={{ margin: 0 }}>{String(ops.verifyQueuePriority)}</dd>
                    </>
                  )}
                </dl>
                {Boolean((report as unknown as Record<string, unknown>).description) && (
                  <p style={{ marginTop: 10, fontSize: 13, color: '#1d1d1f', lineHeight: 1.5 }}>
                    {String((report as unknown as Record<string, unknown>).description)}
                  </p>
                )}
              </div>

              {/* Primary action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button
                  disabled={!canVerify || verifyLoading}
                  onClick={handleVerify}
                  style={{
                    background: canVerify && !verifyLoading ? '#001e40' : '#8a9199',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 18px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: canVerify && !verifyLoading ? 'pointer' : 'default',
                    minHeight: 44,
                    transition: 'background 150ms',
                  }}
                >
                  {verifyLoading
                    ? 'Verifying…'
                    : report.status === 'new'
                      ? 'Open for Verify'
                      : 'Verify'}
                </button>
                <button
                  disabled={!canReject}
                  onClick={() => {
                    setRejectOpen((o) => !o)
                    setActionBanner(null)
                  }}
                  style={{
                    background: canReject ? '#a73400' : '#8a9199',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 18px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: canReject ? 'pointer' : 'default',
                    minHeight: 44,
                    transition: 'background 150ms',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertTriangle style={{ width: 14, height: 14 }} />
                  Reject
                </button>
                <button
                  disabled={!canDispatch}
                  onClick={() => {
                    onDispatch(reportId)
                  }}
                  style={{
                    background: 'transparent',
                    color: canDispatch ? '#001e40' : '#8a9199',
                    border: `1px solid ${canDispatch ? '#001e40' : '#dfe3e8'}`,
                    borderRadius: 6,
                    padding: '10px 18px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: canDispatch ? 'pointer' : 'default',
                    minHeight: 44,
                    transition: 'all 150ms',
                  }}
                >
                  Dispatch
                </button>
                {canClose && (
                  <button
                    onClick={() => {
                      onCloseReport(reportId)
                    }}
                    style={{
                      background: 'transparent',
                      color: '#001e40',
                      border: '1px solid #001e40',
                      borderRadius: 6,
                      padding: '10px 18px',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    Close Report
                  </button>
                )}
              </div>

              {/* Reject form (inline expand) */}
              {rejectOpen && (
                <div
                  style={{
                    border: '1px solid #a73400',
                    borderRadius: 8,
                    padding: '16px',
                    marginBottom: 16,
                    background: '#fff7f5',
                  }}
                >
                  <h3
                    style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#a73400' }}
                  >
                    Reject Report
                  </h3>
                  <div style={{ marginBottom: 10 }}>
                    <label
                      htmlFor="reject-reason-panel"
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
                      id="reject-reason-panel"
                      value={rejectReason}
                      onChange={(e) => {
                        setRejectReason(e.target.value as RejectReason | '')
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #dfe3e8',
                        fontSize: 13,
                        minHeight: 44,
                      }}
                    >
                      <option value="">Select reason…</option>
                      {REJECT_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label
                      htmlFor="reject-notes-panel"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#556068',
                        marginBottom: 4,
                      }}
                    >
                      Notes (optional)
                    </label>
                    <textarea
                      id="reject-notes-panel"
                      value={rejectNotes}
                      onChange={(e) => {
                        setRejectNotes(e.target.value)
                      }}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #dfe3e8',
                        fontSize: 13,
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Optional notes for audit trail…"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      disabled={!rejectReason || rejectLoading}
                      onClick={handleConfirmReject}
                      style={{
                        background: rejectReason && !rejectLoading ? '#a73400' : '#8a9199',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: rejectReason && !rejectLoading ? 'pointer' : 'default',
                        minHeight: 40,
                      }}
                    >
                      {rejectLoading ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => {
                        setRejectOpen(false)
                      }}
                      style={{
                        background: 'transparent',
                        color: '#556068',
                        border: '1px solid #dfe3e8',
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        minHeight: 40,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Agency Assistance */}
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => {
                    setAgencyOpen((o) => !o)
                    setActionBanner(null)
                  }}
                  style={{
                    background: 'transparent',
                    color: '#001e40',
                    border: '1px solid #001e40',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    minHeight: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Request Agency Assistance
                  <ChevronDown
                    style={{
                      width: 14,
                      height: 14,
                      transform: agencyOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms',
                    }}
                  />
                </button>

                {agencyOpen && (
                  <div
                    style={{
                      marginTop: 10,
                      border: '1px solid #dfe3e8',
                      borderRadius: 8,
                      padding: '16px',
                      background: '#f6f7f9',
                    }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <label
                        htmlFor="agency-select"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#556068',
                          marginBottom: 4,
                        }}
                      >
                        Agency
                      </label>
                      <select
                        id="agency-select"
                        value={agencyForm.agencyId}
                        onChange={(e) => {
                          setAgencyForm((f) => ({ ...f, agencyId: e.target.value }))
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #dfe3e8',
                          fontSize: 13,
                          minHeight: 44,
                          background: '#ffffff',
                        }}
                      >
                        <option value="">Select agency…</option>
                        {agencies.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label
                        htmlFor="agency-request-type"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#556068',
                          marginBottom: 4,
                        }}
                      >
                        Request Type
                      </label>
                      <select
                        id="agency-request-type"
                        value={agencyForm.requestType}
                        onChange={(e) => {
                          setAgencyForm((f) => ({ ...f, requestType: e.target.value }))
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #dfe3e8',
                          fontSize: 13,
                          minHeight: 44,
                          background: '#ffffff',
                        }}
                      >
                        <option value="">Select type…</option>
                        {REQUEST_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <span
                        id="agency-priority-label"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#556068',
                          marginBottom: 6,
                        }}
                      >
                        Priority
                      </span>
                      <div
                        role="radiogroup"
                        aria-label="Priority"
                        style={{ display: 'flex', gap: 16 }}
                      >
                        {(['routine', 'urgent', 'emergency'] as const).map((p) => (
                          <label
                            key={p}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="radio"
                              name="agency-priority"
                              value={p}
                              checked={agencyForm.priority === p}
                              onChange={() => {
                                setAgencyForm((f) => ({ ...f, priority: p }))
                              }}
                            />
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label
                        htmlFor="agency-message"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#556068',
                          marginBottom: 4,
                        }}
                      >
                        Message
                      </label>
                      <textarea
                        id="agency-message"
                        value={agencyForm.message}
                        onChange={(e) => {
                          setAgencyForm((f) => ({ ...f, message: e.target.value }))
                        }}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #dfe3e8',
                          fontSize: 13,
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                        placeholder="Describe the assistance needed…"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={
                          !agencyForm.agencyId ||
                          !agencyForm.requestType ||
                          !agencyForm.message.trim() ||
                          agencyLoading
                        }
                        onClick={handleSendAgencyRequest}
                        style={{
                          background:
                            agencyForm.agencyId &&
                            agencyForm.requestType &&
                            agencyForm.message.trim() &&
                            !agencyLoading
                              ? '#001e40'
                              : '#8a9199',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 16px',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor:
                            agencyForm.agencyId &&
                            agencyForm.requestType &&
                            agencyForm.message.trim() &&
                            !agencyLoading
                              ? 'pointer'
                              : 'default',
                          minHeight: 40,
                        }}
                      >
                        {agencyLoading ? 'Sending…' : 'Send Request'}
                      </button>
                      <button
                        onClick={() => {
                          setAgencyOpen(false)
                        }}
                        style={{
                          background: 'transparent',
                          color: '#556068',
                          border: '1px solid #dfe3e8',
                          borderRadius: 6,
                          padding: '8px 16px',
                          fontWeight: 500,
                          fontSize: 13,
                          cursor: 'pointer',
                          minHeight: 40,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Command channel */}
              <CommandChannelPanel reportId={reportId} currentUserUid={currentUserUid} />
            </>
          )}
        </div>
      </div>

      {/* Slide-in animation keyframe — injected once via style tag */}
      <style>{`
        @keyframes triagePanelSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
