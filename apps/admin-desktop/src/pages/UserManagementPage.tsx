import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'

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

  return (
    <div style={PAGE_STYLE}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
        User Management
      </h1>

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
                        {/* No-op stubs — callable implementations pending 7.A */}
                        <button
                          style={BTN_DANGER_STYLE}
                          onClick={() => {
                            console.warn('suspend not yet implemented', u.id)
                          }}
                        >
                          Suspend
                        </button>
                        <button
                          style={BTN_DANGER_STYLE}
                          onClick={() => {
                            console.warn('revoke not yet implemented', u.id)
                          }}
                        >
                          Revoke
                        </button>
                        <button
                          style={BTN_STYLE}
                          onClick={() => {
                            console.warn('reset TOTP not yet implemented', u.id)
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
