import { useState, useEffect } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useRosterManagement, type RosterResponder } from '../hooks/useRosterManagement'
import { computeFreshness, type Freshness } from '../utils/freshness'
import { callables } from '../services/callables'

const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: 'green',
  degraded: 'orange',
  stale: '#c60',
  offline: '#999',
}

// Responder type badge colors
const RESPONDER_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  POL: { bg: '#dbeafe', text: '#1e40af' },
  FIR: { bg: '#fee2e2', text: '#991b1b' },
  MED: { bg: '#dcfce7', text: '#166534' },
  ENG: { bg: '#fef9c3', text: '#854d0e' },
  SAR: { bg: '#f3e8ff', text: '#6b21a8' },
  SW: { bg: '#cffafe', text: '#164e63' },
  GEN: { bg: '#f0f4f8', text: '#334155' },
}

interface RevokeState {
  uid: string
  reason: string
}

interface BulkConfirmState {
  // 'available' maps to the "Set All On-Duty" action; 'off_duty' to "Set All Off-Duty"
  targetStatus: 'available' | 'off_duty'
  label: string
}

function SpecializationChips({ specializations }: { specializations: string[] }) {
  if (specializations.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {specializations.map((s) => (
        <span
          key={s}
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.7rem',
            fontWeight: 500,
            background: '#f0f4f8',
            color: '#334155',
            border: '1px solid #dfe3e8',
          }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}

function ResponderRow({
  r,
  actingUid,
  revokeState,
  onSuspend,
  onRevokeClick,
  onRevokeSubmit,
  onRevokeCancel,
  onRevokeReasonChange,
}: {
  r: RosterResponder
  actingUid: string | null
  revokeState: RevokeState | null
  onSuspend: (uid: string) => void
  onRevokeClick: (uid: string) => void
  onRevokeSubmit: () => void
  onRevokeCancel: () => void
  onRevokeReasonChange: (reason: string) => void
}) {
  const freshness = computeFreshness(r.lastTelemetryAt)
  const typeStyle = RESPONDER_TYPE_STYLE[r.responderType] ??
    RESPONDER_TYPE_STYLE.GEN ?? { bg: '#f3f4f6', text: '#374151' }
  const isRevokingThis = revokeState?.uid === r.uid
  const warningId = `revoke-warning-${r.uid}`

  return (
    <li
      style={{
        marginBottom: 12,
        border: '1px solid #dfe3e8',
        borderRadius: 8,
        padding: 16,
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Identity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="checkbox"
          aria-label={`Select ${r.displayName}`}
          style={{ width: 16, height: 16 }}
          disabled
        />
        {/* Responder type badge */}
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.7rem',
            fontWeight: 700,
            background: typeStyle.bg,
            color: typeStyle.text,
            letterSpacing: '0.05em',
          }}
        >
          {r.responderType}
        </span>
        <strong style={{ fontSize: 14, color: '#1d1d1f' }}>{r.displayName}</strong>
        {/* Availability status */}
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            background: '#f0f4f8',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: '#556068',
          }}
        >
          {r.availabilityStatus}
        </span>
        {r.lastTelemetryAt != null && (
          <span style={{ fontSize: '0.75rem', color: FRESHNESS_COLOR[freshness] }}>
            {freshness} · {new Date(r.lastTelemetryAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Specialization chips */}
      <SpecializationChips specializations={r.specializations} />

      {/* Actions */}
      <div style={{ marginTop: 12 }}>
        {isRevokingThis ? (
          <div>
            <p
              id={warningId}
              style={{
                fontSize: 13,
                color: '#991b1b',
                background: '#fee2e2',
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              This immediately ends their active session and logs them out of all devices.
            </p>
            <label
              htmlFor={`revoke-reason-${r.uid}`}
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Reason for revoke
            </label>
            <textarea
              id={`revoke-reason-${r.uid}`}
              placeholder="Reason for revoke..."
              value={revokeState.reason}
              onChange={(e) => {
                onRevokeReasonChange(e.target.value)
              }}
              aria-describedby={warningId}
              style={{
                display: 'block',
                width: '100%',
                minHeight: 56,
                padding: '6px 8px',
                border: '1px solid #dfe3e8',
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={!revokeState.reason.trim() || actingUid === r.uid}
                onClick={onRevokeSubmit}
                style={{
                  padding: '8px 16px',
                  background: '#a73400',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: revokeState.reason.trim() ? 'pointer' : 'not-allowed',
                  minHeight: 44,
                  fontSize: 13,
                }}
              >
                Confirm Revoke
              </button>
              <button
                onClick={onRevokeCancel}
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
              disabled={actingUid === r.uid}
              onClick={() => {
                onSuspend(r.uid)
              }}
              style={{
                padding: '6px 14px',
                background: '#f0f4f8',
                color: '#1d1d1f',
                border: '1px solid #dfe3e8',
                borderRadius: 6,
                cursor: 'pointer',
                minHeight: 36,
                fontSize: 13,
              }}
            >
              Suspend
            </button>
            <button
              disabled={actingUid === r.uid}
              onClick={() => {
                onRevokeClick(r.uid)
              }}
              style={{
                padding: '6px 14px',
                background: '#fff0ee',
                color: '#a73400',
                border: '1px solid #f4c3b2',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 36,
                fontSize: 13,
              }}
            >
              Revoke Access
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

export function RosterPage() {
  const { claims } = useAuth()
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : undefined
  const {
    responders,
    loading,
    error,
    suspendResponder,
    revokeResponder,
    bulkAvailabilityOverride,
  } = useRosterManagement(agencyId)

  const [banner, setBanner] = useState<string | null>(null)
  const [actingUid, setActingUid] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [revokeState, setRevokeState] = useState<RevokeState | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirmState | null>(null)
  const [, setTick] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    displayName: '',
    phone: '',
    specializations: [] as string[],
    specInput: '',
  })
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, 30_000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const handleSuspend = (uid: string) => {
    void (async () => {
      setActingUid(uid)
      try {
        await suspendResponder(uid)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Suspend failed')
      } finally {
        setActingUid(null)
      }
    })()
  }

  const handleRevokeClick = (uid: string) => {
    setRevokeState({ uid, reason: '' })
  }

  const handleRevokeSubmit = () => {
    if (!revokeState?.reason.trim()) return
    const { uid } = revokeState
    void (async () => {
      setActingUid(uid)
      try {
        await revokeResponder(uid)
        setRevokeState(null)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Revoke failed')
      } finally {
        setActingUid(null)
      }
    })()
  }

  const handleRevokeCancel = () => {
    setRevokeState(null)
  }

  const handleRevokeReasonChange = (reason: string) => {
    setRevokeState((prev) => (prev ? { ...prev, reason } : null))
  }

  const handleBulkRequest = (targetStatus: 'available' | 'off_duty') => {
    const label = targetStatus === 'available' ? 'On-Duty' : 'Off-Duty'
    setBulkConfirm({ targetStatus, label })
  }

  const handleBulkConfirm = () => {
    if (!bulkConfirm) return
    const { targetStatus } = bulkConfirm
    const uids = responders.map((r) => r.uid)
    if (uids.length === 0) return
    void (async () => {
      setBulkLoading(true)
      try {
        await bulkAvailabilityOverride(uids, targetStatus)
        setBulkConfirm(null)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Bulk override failed')
      } finally {
        setBulkLoading(false)
      }
    })()
  }

  const handleBulkCancel = () => {
    setBulkConfirm(null)
  }

  const handleCreateResponder = async () => {
    if (!createForm.displayName.trim() || !createForm.phone.trim() || !agencyId) return
    setCreateLoading(true)
    setBanner(null)
    try {
      const payload: Parameters<typeof callables.createResponder>[0] = {
        displayName: createForm.displayName.trim(),
        phone: createForm.phone.trim(),
        agencyId,
        idempotencyKey: crypto.randomUUID(),
      }
      if (createForm.specializations.length > 0) {
        payload.specializations = createForm.specializations
      }
      await callables.createResponder(payload)
      setCreateOpen(false)
      setCreateForm({ displayName: '', phone: '', specializations: [], specInput: '' })
    } catch (err: unknown) {
      setBanner(err instanceof Error ? err.message : 'Create responder failed')
    } finally {
      setCreateLoading(false)
    }
  }

  const addSpecialization = () => {
    const trimmed = createForm.specInput.trim()
    if (!trimmed) return
    if (createForm.specializations.includes(trimmed)) return
    setCreateForm((f) => ({
      ...f,
      specializations: [...f.specializations, trimmed],
      specInput: '',
    }))
  }

  const removeSpecialization = (spec: string) => {
    setCreateForm((f) => ({
      ...f,
      specializations: f.specializations.filter((s) => s !== spec),
    }))
  }

  return (
    <main style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#001e40', margin: 0 }}>
          Roster · {agencyId ?? 'N/A'}
        </h1>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              setCreateOpen(true)
              setBanner(null)
            }}
            style={{
              padding: '8px 16px',
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
            Add Responder
          </button>
        </div>

        {/* Bulk shift toggle buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              handleBulkRequest('available')
            }}
            disabled={bulkLoading || responders.length === 0}
            style={{
              padding: '8px 16px',
              background: '#001e40',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: responders.length > 0 ? 'pointer' : 'not-allowed',
              minHeight: 44,
              fontSize: 13,
            }}
          >
            Set All On-Duty
          </button>
          <button
            onClick={() => {
              handleBulkRequest('off_duty')
            }}
            disabled={bulkLoading || responders.length === 0}
            style={{
              padding: '8px 16px',
              background: '#f0f4f8',
              color: '#1d1d1f',
              border: '1px solid #dfe3e8',
              borderRadius: 6,
              fontWeight: 500,
              cursor: responders.length > 0 ? 'pointer' : 'not-allowed',
              minHeight: 44,
              fontSize: 13,
            }}
          >
            Set All Off-Duty
          </button>
        </div>
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

      {/* Inline bulk confirmation panel */}
      {bulkConfirm && (
        <div
          role="region"
          aria-label="Bulk shift confirmation"
          style={{
            padding: '16px',
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: '#854d0e', flex: 1 }}>
            This will set <strong>all {String(responders.length)} responders</strong> to{' '}
            <strong>{bulkConfirm.label}</strong>. Confirm?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleBulkConfirm}
              disabled={bulkLoading}
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
              Confirm
            </button>
            <button
              onClick={handleBulkCancel}
              style={{
                padding: '8px 16px',
                background: '#ffffff',
                color: '#1d1d1f',
                border: '1px solid #dfe3e8',
                borderRadius: 6,
                cursor: 'pointer',
                minHeight: 44,
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {createOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setCreateOpen(false)
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#001e40' }}>
              Add Responder
            </h2>
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="cr-displayName"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#556068',
                  marginBottom: '4px',
                }}
              >
                Display Name
              </label>
              <input
                id="cr-displayName"
                type="text"
                value={createForm.displayName}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, displayName: e.target.value }))
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #dfe3e8',
                  fontSize: 13,
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
                placeholder="Full name"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="cr-phone"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#556068',
                  marginBottom: '4px',
                }}
              >
                Phone
              </label>
              <input
                id="cr-phone"
                type="tel"
                value={createForm.phone}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, phone: e.target.value }))
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #dfe3e8',
                  fontSize: 13,
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
                placeholder="+63..."
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="cr-spec"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#556068',
                  marginBottom: '4px',
                }}
              >
                Specializations
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="cr-spec"
                  type="text"
                  value={createForm.specInput}
                  onChange={(e) => {
                    setCreateForm((f) => ({ ...f, specInput: e.target.value }))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSpecialization()
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #dfe3e8',
                    fontSize: 13,
                    minHeight: 44,
                    boxSizing: 'border-box',
                  }}
                  placeholder="Type and press Enter"
                />
                <button
                  type="button"
                  onClick={addSpecialization}
                  style={{
                    padding: '8px 14px',
                    background: '#f0f4f8',
                    border: '1px solid #dfe3e8',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Add
                </button>
              </div>
              {createForm.specializations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {createForm.specializations.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        background: '#f0f4f8',
                        color: '#334155',
                        border: '1px solid #dfe3e8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => {
                          removeSpecialization(s)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          color: '#991b1b',
                          padding: 0,
                        }}
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={
                  !createForm.displayName.trim() || !createForm.phone.trim() || createLoading
                }
                onClick={() => {
                  void handleCreateResponder()
                }}
                style={{
                  padding: '8px 16px',
                  background:
                    createForm.displayName.trim() && createForm.phone.trim() && !createLoading
                      ? '#001e40'
                      : '#8a9199',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor:
                    createForm.displayName.trim() && createForm.phone.trim() && !createLoading
                      ? 'pointer'
                      : 'default',
                  minHeight: 40,
                  fontSize: 13,
                }}
              >
                {createLoading ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                }}
                style={{
                  padding: '8px 16px',
                  background: '#f0f4f8',
                  color: '#1d1d1f',
                  border: '1px solid #dfe3e8',
                  borderRadius: 6,
                  cursor: 'pointer',
                  minHeight: 40,
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p aria-live="polite">Loading…</p>
      ) : error ? (
        <p role="alert">Error: {error}</p>
      ) : responders.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            border: '1px dashed #dfe3e8',
            borderRadius: 10,
            color: '#8a9199',
          }}
        >
          <p style={{ margin: 0, fontSize: 15 }}>No responders</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Responders assigned to this agency will appear here.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {responders.map((r) => (
            <ResponderRow
              key={r.uid}
              r={r}
              actingUid={actingUid}
              revokeState={revokeState?.uid === r.uid ? revokeState : null}
              onSuspend={handleSuspend}
              onRevokeClick={handleRevokeClick}
              onRevokeSubmit={handleRevokeSubmit}
              onRevokeCancel={handleRevokeCancel}
              onRevokeReasonChange={handleRevokeReasonChange}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
