import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import type { UserRole } from '@bantayog/shared-types'

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  height: '100%',
  boxSizing: 'border-box',
}

const LAYOUT_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 360px',
  gap: '20px',
  alignItems: 'start',
}

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px 20px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: '12px',
}

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
}

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '2px solid #e5e7eb',
  fontWeight: 600,
  color: '#374151',
  background: '#f9fafb',
  whiteSpace: 'nowrap',
}

const TD_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #e5e7eb',
  color: '#111827',
  verticalAlign: 'middle',
}

const BTN_STYLE: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
  marginRight: '6px',
}

const BTN_DANGER_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  border: '1px solid #fca5a5',
  background: '#fee2e2',
  color: '#991b1b',
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  borderRadius: '6px',
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
}

const BADGE_STYLE = (ok: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '9999px',
  fontSize: '11px',
  fontWeight: 600,
  background: ok ? '#d1fae5' : '#f3f4f6',
  color: ok ? '#065f46' : '#6b7280',
})

const ERASURE_ITEM_STYLE: React.CSSProperties = {
  padding: '12px',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  marginBottom: '8px',
  fontSize: '13px',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  municipality: string
  mfaEnrolled: boolean
  lastLogin: Timestamp | null
}

interface ErasureRequest {
  id: string
  userEmail: string
  reason: string
  requestedAt: Timestamp | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toStr(val: unknown, fallback = '—'): string {
  return typeof val === 'string' ? val : fallback
}

function toTimestamp(val: unknown): Timestamp | null {
  if (val != null && typeof (val as Timestamp).toDate === 'function') {
    return val as Timestamp
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [erasureRequests, setErasureRequests] = useState<ErasureRequest[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [processingUserId, setProcessingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    displayName: '',
    phone: '',
    role: '' as UserRole | '',
    municipalityId: '',
    agencyId: '',
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email'))
    return onSnapshot(q, (snap) => {
      setUsers(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: toStr(data.displayName),
            email: toStr(data.email),
            role: toStr(data.role),
            municipality: toStr(data.municipality),
            mfaEnrolled: data.mfaEnrolled === true,
            lastLogin: toTimestamp(data.lastLogin),
          }
        }),
      )
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'erasure_requests'), orderBy('requestedAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setErasureRequests(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            userEmail: toStr(data.userEmail),
            reason: toStr(data.reason),
            requestedAt: toTimestamp(data.requestedAt),
          }
        }),
      )
    })
  }, [])

  const handleApproveErasure = async (requestId: string) => {
    setApprovingId(requestId)
    try {
      await callables.approveErasureRequest({ erasureRequestId: requestId, approved: true })
    } catch (err) {
      console.error('approveErasureRequest failed', err)
    } finally {
      setApprovingId(null)
    }
  }

  const handleSuspend = async (uid: string) => {
    if (!window.confirm('Suspend user? They will be unable to sign in.')) return
    setProcessingUserId(uid)
    setError(null)
    try {
      await callables.suspendUser({ uid, idempotencyKey: crypto.randomUUID() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Suspend failed'
      setError(message)
      console.error('suspendUser failed', err)
    } finally {
      setProcessingUserId(null)
    }
  }

  const handleRevoke = async (uid: string) => {
    if (!window.confirm('Permanently revoke this user? This cannot be undone.')) return
    setProcessingUserId(uid)
    setError(null)
    try {
      await callables.revokeUser({ uid, idempotencyKey: crypto.randomUUID() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Revoke failed'
      setError(message)
      console.error('revokeUser failed', err)
    } finally {
      setProcessingUserId(null)
    }
  }

  const handleResetTotp = async (uid: string) => {
    if (!window.confirm('Reset TOTP for this user? They will need to re-enroll MFA.')) return
    setProcessingUserId(uid)
    setError(null)
    try {
      await callables.resetUserTotp({ uid, idempotencyKey: crypto.randomUUID() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset TOTP failed'
      setError(message)
      console.error('resetUserTotp failed', err)
    } finally {
      setProcessingUserId(null)
    }
  }

  const handleCreateUser = async () => {
    if (!createForm.displayName.trim() || !createForm.phone.trim() || !createForm.role) return
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      const result = await callables.createUser({
        displayName: createForm.displayName.trim(),
        phone: createForm.phone.trim(),
        role: createForm.role,
        ...(createForm.municipalityId.trim()
          ? { municipalityId: createForm.municipalityId.trim() }
          : {}),
        ...(createForm.agencyId.trim() ? { agencyId: createForm.agencyId.trim() } : {}),
        idempotencyKey: crypto.randomUUID(),
      })
      setCreateSuccess(`User created: ${result.uid}`)
      setCreateForm({ displayName: '', phone: '', role: '', municipalityId: '', agencyId: '' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Create user failed'
      setCreateError(message)
      console.error('createUser failed', err)
    } finally {
      setCreateLoading(false)
    }
  }

  const showMunicipality = createForm.role === 'municipal_admin' || createForm.role === 'responder'
  const showAgency = createForm.role === 'agency_admin' || createForm.role === 'responder'

  return (
    <div style={PAGE_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
          User Management
        </h1>
        <button
          type="button"
          style={BTN_PRIMARY_STYLE}
          onClick={() => {
            setCreateOpen(true)
            setCreateError(null)
            setCreateSuccess(null)
          }}
        >
          Create User
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => {
              setError(null)
            }}
            style={{
              marginLeft: '12px',
              background: 'transparent',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontSize: '13px',
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
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
            ref={(node) => {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (node && createOpen) {
                node.focus()
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            tabIndex={-1}
            style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <h2
              id="create-user-title"
              style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#111827' }}
            >
              Create User
            </h2>
            {createError && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '13px',
                  marginBottom: '12px',
                }}
              >
                {createError}
              </div>
            )}
            {createSuccess && (
              <div
                role="status"
                style={{
                  padding: '10px 12px',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  color: '#16a34a',
                  fontSize: '13px',
                  marginBottom: '12px',
                }}
              >
                {createSuccess}
              </div>
            )}
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="cu-displayName"
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
                id="cu-displayName"
                type="text"
                value={createForm.displayName}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, displayName: e.target.value }))
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #dfe3e8',
                  fontSize: '13px',
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
                placeholder="Full name"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="cu-phone"
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
                id="cu-phone"
                type="tel"
                value={createForm.phone}
                onChange={(e) => {
                  setCreateForm((f) => ({ ...f, phone: e.target.value }))
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #dfe3e8',
                  fontSize: '13px',
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
                placeholder="+63..."
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="cu-role"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#556068',
                  marginBottom: '4px',
                }}
              >
                Role
              </label>
              <select
                id="cu-role"
                value={createForm.role}
                onChange={(e) => {
                  setCreateForm((f) => ({
                    ...f,
                    role: e.target.value as UserRole | '',
                    municipalityId: '',
                    agencyId: '',
                  }))
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #dfe3e8',
                  fontSize: '13px',
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select role…</option>
                <option value="municipal_admin">Municipal Admin</option>
                <option value="agency_admin">Agency Admin</option>
                <option value="responder">Responder</option>
                <option value="provincial_superadmin">Provincial Superadmin</option>
              </select>
            </div>
            {showMunicipality && (
              <div style={{ marginBottom: '12px' }}>
                <label
                  htmlFor="cu-municipalityId"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#556068',
                    marginBottom: '4px',
                  }}
                >
                  Municipality ID
                </label>
                <input
                  id="cu-municipalityId"
                  type="text"
                  value={createForm.municipalityId}
                  onChange={(e) => {
                    setCreateForm((f) => ({ ...f, municipalityId: e.target.value }))
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #dfe3e8',
                    fontSize: '13px',
                    minHeight: 44,
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. daet"
                />
              </div>
            )}
            {showAgency && (
              <div style={{ marginBottom: '12px' }}>
                <label
                  htmlFor="cu-agencyId"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#556068',
                    marginBottom: '4px',
                  }}
                >
                  Agency ID
                </label>
                <input
                  id="cu-agencyId"
                  type="text"
                  value={createForm.agencyId}
                  onChange={(e) => {
                    setCreateForm((f) => ({ ...f, agencyId: e.target.value }))
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #dfe3e8',
                    fontSize: '13px',
                    minHeight: 44,
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. bfp-daet"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={
                  !createForm.displayName.trim() ||
                  !createForm.phone.trim() ||
                  !createForm.role ||
                  createLoading
                }
                onClick={() => {
                  void handleCreateUser()
                }}
                style={{
                  ...BTN_PRIMARY_STYLE,
                  opacity:
                    createForm.displayName.trim() &&
                    createForm.phone.trim() &&
                    createForm.role &&
                    !createLoading
                      ? 1
                      : 0.5,
                }}
              >
                {createLoading ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                }}
                style={BTN_STYLE}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={LAYOUT_STYLE}>
        {/* User table */}
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Province Users</div>
          {users.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#6b7280' }}>No users found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={TABLE_STYLE}>
                <thead>
                  <tr>
                    <th style={TH_STYLE}>Name</th>
                    <th style={TH_STYLE}>Email</th>
                    <th style={TH_STYLE}>Role</th>
                    <th style={TH_STYLE}>Municipality</th>
                    <th style={TH_STYLE}>MFA</th>
                    <th style={TH_STYLE}>Last Login</th>
                    <th style={TH_STYLE}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={TD_STYLE}>{u.name}</td>
                      <td style={TD_STYLE}>{u.email}</td>
                      <td style={TD_STYLE}>{u.role}</td>
                      <td style={TD_STYLE}>{u.municipality}</td>
                      <td style={TD_STYLE}>
                        <span style={BADGE_STYLE(u.mfaEnrolled)}>
                          {u.mfaEnrolled ? 'Enrolled' : 'Not enrolled'}
                        </span>
                      </td>
                      <td style={TD_STYLE}>{u.lastLogin?.toDate().toLocaleString() ?? '—'}</td>
                      <td style={TD_STYLE}>
                        <button
                          type="button"
                          style={BTN_DANGER_STYLE}
                          disabled={processingUserId === u.id}
                          onClick={() => {
                            void handleSuspend(u.id)
                          }}
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          style={BTN_DANGER_STYLE}
                          disabled={processingUserId === u.id}
                          onClick={() => {
                            void handleRevoke(u.id)
                          }}
                        >
                          Revoke
                        </button>
                        <button
                          type="button"
                          style={BTN_STYLE}
                          disabled={processingUserId === u.id}
                          onClick={() => {
                            void handleResetTotp(u.id)
                          }}
                        >
                          Reset TOTP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Erasure requests drawer */}
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Erasure Requests ({erasureRequests.length})</div>
          {erasureRequests.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#6b7280' }}>No pending erasure requests.</p>
          ) : (
            erasureRequests.map((req) => (
              <div key={req.id} style={ERASURE_ITEM_STYLE}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{req.userEmail}</div>
                <div style={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px' }}>
                  {req.requestedAt?.toDate().toLocaleDateString() ?? '—'}
                </div>
                <div style={{ marginBottom: '8px' }}>{req.reason}</div>
                <button
                  style={BTN_PRIMARY_STYLE}
                  disabled={approvingId === req.id}
                  onClick={() => {
                    void handleApproveErasure(req.id)
                  }}
                >
                  {approvingId === req.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
