import { useState, useEffect, useCallback } from 'react'
import { callables } from '../services/callables'
import { useAuth } from '@bantayog/shared-ui'
import { useAgencyAssistanceQueue } from '../hooks/useAgencyAssistanceQueue'
import type { AgencyAssistanceRequestDoc } from '@bantayog/shared-validators'
import { AgencyDispatchModal } from './AgencyDispatchModal'

type FilterTab = 'pending' | 'accepted' | 'all'

interface DeclineState {
  requestId: string
  reason: string
}

type AssistanceRequest = AgencyAssistanceRequestDoc & { id: string }

// Priority badge styling using design-system status tokens
const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: '#fef3c7', text: '#92400e', label: 'Urgent' },
  normal: { bg: '#dcfce7', text: '#16a34a', label: 'Routine' },
}

function formatCountdown(expiresAt: number): string {
  const diffMs = expiresAt - Date.now()
  if (diffMs <= 0) return 'Expired'
  const totalSec = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${String(h)}h ${String(m)}m remaining`
  if (m > 0) return `${String(m)}m ${String(s)}s remaining`
  return `${String(s)}s remaining`
}

function isExpired(expiresAt: number): boolean {
  return expiresAt <= Date.now()
}

function RequestCard({
  req,
  declineState,
  onAccept,
  onDecline,
  onDeclineSubmit,
  onDeclineCancel,
  onDeclineReasonChange,
  onDispatch,
}: {
  req: AssistanceRequest
  declineState: DeclineState | null
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onDeclineSubmit: () => void
  onDeclineCancel: () => void
  onDeclineReasonChange: (reason: string) => void
  onDispatch: (reportId: string) => void
}) {
  const [countdown, setCountdown] = useState(() => formatCountdown(req.expiresAt))
  const expired = isExpired(req.expiresAt)
  const priority = PRIORITY_STYLE[req.priority] ??
    PRIORITY_STYLE.normal ?? { bg: '#f3f4f6', text: '#374151', label: req.priority }

  useEffect(() => {
    if (expired) return
    const id = setInterval(() => {
      setCountdown(formatCountdown(req.expiresAt))
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [req.expiresAt, expired])

  const isExpiredStatus = req.status === 'expired' || expired

  return (
    <li
      style={{
        marginBottom: 16,
        border: '1px solid #dfe3e8',
        borderRadius: 8,
        padding: 16,
        background: isExpiredStatus ? '#f9fafb' : '#ffffff',
        opacity: isExpiredStatus ? 0.7 : 1,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header row: municipality + priority badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 15, color: '#1d1d1f' }}>{req.requestedByMunicipality}</strong>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.75rem',
            fontWeight: 600,
            background: priority.bg,
            color: priority.text,
          }}
        >
          {priority.label}
        </span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.75rem',
            background: '#f0f4f8',
            color: '#556068',
          }}
        >
          {req.requestType}
        </span>
        {isExpiredStatus && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#fee2e2',
              color: '#991b1b',
            }}
          >
            Expired
          </span>
        )}
      </div>

      {/* Message */}
      <p style={{ margin: '0 0 8px', color: '#1d1d1f', fontSize: 14 }}>{req.message}</p>

      {/* Report ID + countdown */}
      <div
        style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: '0.8rem', color: '#8a9199' }}
      >
        <span>Report: {req.reportId}</span>
        {!isExpiredStatus && (
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{ color: countdown.startsWith('Expired') ? '#991b1b' : '#92400e' }}
          >
            {countdown}
          </span>
        )}
      </div>

      {/* Actions — only for pending non-expired agency requests */}
      {req.status === 'pending' && !isExpiredStatus && (
        <div style={{ marginTop: 8 }}>
          {declineState?.requestId === req.id ? (
            <div>
              <label
                htmlFor={`decline-reason-${req.id}`}
                style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}
              >
                Reason for declining
              </label>
              <textarea
                id={`decline-reason-${req.id}`}
                placeholder="Reason for declining..."
                value={declineState.reason}
                onChange={(e) => {
                  onDeclineReasonChange(e.target.value)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: 8,
                  minHeight: 64,
                  padding: '6px 8px',
                  border: '1px solid #dfe3e8',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onDeclineSubmit}
                  disabled={!declineState.reason.trim()}
                  style={{
                    padding: '8px 16px',
                    background: '#a73400',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: declineState.reason.trim() ? 'pointer' : 'not-allowed',
                    minHeight: 44,
                    fontSize: 13,
                  }}
                >
                  Submit Decline
                </button>
                <button
                  onClick={onDeclineCancel}
                  style={{
                    padding: '8px 16px',
                    background: '#f0f4f8',
                    color: '#1d1d1f',
                    border: '1px solid #dfe3e8',
                    borderRadius: 6,
                    fontWeight: 500,
                    cursor: 'pointer',
                    minHeight: 44,
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  onAccept(req.id)
                }}
                style={{
                  padding: '8px 20px',
                  background: '#001e40',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44,
                  fontSize: 13,
                }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  onDecline(req.id)
                }}
                style={{
                  padding: '8px 20px',
                  background: '#ffffff',
                  color: '#1d1d1f',
                  border: '1px solid #dfe3e8',
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: 'pointer',
                  minHeight: 44,
                  fontSize: 13,
                }}
              >
                Decline
              </button>
            </div>
          )}
        </div>
      )}
      {req.status === 'accepted' && !isExpiredStatus && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => {
              onDispatch(req.reportId)
            }}
            style={{
              padding: '8px 20px',
              background: '#001e40',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              fontSize: 13,
            }}
          >
            Dispatch Responder
          </button>
        </div>
      )}
    </li>
  )
}

export function AgencyAssistanceQueuePage() {
  const { claims } = useAuth()
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : undefined
  const { requests, backupRequests, loading, error } = useAgencyAssistanceQueue(agencyId)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [declineState, setDeclineState] = useState<DeclineState | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [dispatchReportId, setDispatchReportId] = useState<string | null>(null)

  const filteredRequests = requests.filter((r) => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'accepted') return r.status === 'accepted'
    return true
  })

  const filteredBackupRequests = backupRequests.filter((r) => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'accepted') return r.status === 'accepted'
    return true
  })

  const handleAccept = useCallback((requestId: string) => {
    void (async () => {
      try {
        await callables.acceptAgencyAssistance({
          requestId,
          idempotencyKey: crypto.randomUUID(),
        })
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Accept failed')
      }
    })()
  }, [])

  const handleDecline = useCallback((requestId: string) => {
    setDeclineState({ requestId, reason: '' })
  }, [])

  const handleDeclineSubmit = useCallback(() => {
    if (!declineState || declineState.reason.trim() === '') return
    void (async () => {
      try {
        await callables.declineAgencyAssistance({
          requestId: declineState.requestId,
          reason: declineState.reason.trim(),
          idempotencyKey: crypto.randomUUID(),
        })
        setDeclineState(null)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Decline failed')
      }
    })()
  }, [declineState])

  const handleDeclineCancel = useCallback(() => {
    setDeclineState(null)
  }, [])

  const handleDeclineReasonChange = useCallback((reason: string) => {
    setDeclineState((prev) => (prev ? { ...prev, reason } : null))
  }, [])

  return (
    <main style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      {dispatchReportId && (
        <div style={{ marginBottom: 16 }}>
          <AgencyDispatchModal
            reportId={dispatchReportId}
            onClose={() => {
              setDispatchReportId(null)
            }}
            onError={(msg) => {
              setBanner(msg)
            }}
          />
        </div>
      )}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#001e40', margin: 0 }}>
          Agency Assistance
        </h1>
      </header>

      {banner && (
        <div
          role="alert"
          style={{
            padding: '10px 16px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {banner}
        </div>
      )}

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Request filter"
        style={{ display: 'flex', gap: 4, marginBottom: 20 }}
      >
        {(['pending', 'accepted', 'all'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={filter === tab}
            onClick={() => {
              setFilter(tab)
            }}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              fontWeight: filter === tab ? 600 : 400,
              background: filter === tab ? '#001e40' : '#f0f4f8',
              color: filter === tab ? '#fff' : '#556068',
              cursor: 'pointer',
              minHeight: 36,
              fontSize: 13,
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p aria-live="polite">Loading…</p>
      ) : error ? (
        <p role="alert">Error: {error}</p>
      ) : (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 12 }}>
            Agency Assistance Requests
          </h2>
          {filteredRequests.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                border: '1px dashed #dfe3e8',
                borderRadius: 10,
                color: '#8a9199',
                marginBottom: 24,
              }}
            >
              <p style={{ margin: 0, fontSize: 15 }}>No pending assistance requests</p>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                New requests from municipalities will appear here in real time.
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              {filteredRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  declineState={declineState?.requestId === req.id ? declineState : null}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onDeclineSubmit={handleDeclineSubmit}
                  onDeclineCancel={handleDeclineCancel}
                  onDeclineReasonChange={handleDeclineReasonChange}
                  onDispatch={setDispatchReportId}
                />
              ))}
            </ul>
          )}

          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 12 }}>
            Backup Requests
          </h2>
          {filteredBackupRequests.length === 0 ? (
            <p style={{ color: '#8a9199', fontSize: 14 }}>No backup requests.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {filteredBackupRequests.map((req) => (
                <li
                  key={req.id}
                  style={{
                    marginBottom: 16,
                    border: '1px solid #dfe3e8',
                    borderRadius: 8,
                    padding: 16,
                    background: '#ffffff',
                  }}
                >
                  <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1d1d1f' }}>
                    {req.municipalityId}
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 14, color: '#1d1d1f' }}>{req.reason}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#8a9199' }}>
                    Report: {req.reportId}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
