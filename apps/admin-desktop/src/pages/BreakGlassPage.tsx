import { useEffect, useRef, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Shield } from 'lucide-react'
import { db } from '../app/firebase'
import { useBreakGlass } from '../hooks/useBreakGlass'
import { toMs } from '../lib/timestamps'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeLeft(expiresAt: number): string {
  const diffMs = Math.max(0, expiresAt - Date.now())
  const totalSeconds = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '680px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px 24px',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const BTN_RED: React.CSSProperties = {
  padding: '10px 20px',
  background: '#b91c1c',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const TABLE_TH: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  borderBottom: '2px solid #e5e7eb',
}

const TABLE_TD: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '13px',
  borderBottom: '1px solid #f3f4f6',
  color: '#374151',
}

// ── Audit log types ───────────────────────────────────────────────────────────

interface BreakGlassSession {
  id: string
  uid: string
  reason: string
  startedAt: number
  expiresAt: number
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BreakGlassPage() {
  const { active, sessionId, expiresAt, error, loading, initiateSession, deactivateSession } =
    useBreakGlass()

  const [codeA, setCodeA] = useState('')
  const [codeB, setCodeB] = useState('')
  const [reason, setReason] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [timeLeft, setTimeLeft] = useState<string>('72:00:00')
  const [pastSessions, setPastSessions] = useState<BreakGlassSession[]>([])

  // Countdown while session is active
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (active && expiresAt !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(formatTimeLeft(expiresAt))
      intervalRef.current = setInterval(() => {
        setTimeLeft(formatTimeLeft(expiresAt))
      }, 1000)
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [active, expiresAt])

  // Audit log: last 10 break-glass sessions
  useEffect(() => {
    const q = query(collection(db, 'break_glass_sessions'), orderBy('startedAt', 'desc'), limit(10))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: BreakGlassSession[] = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            uid: typeof data.uid === 'string' ? data.uid : '',
            reason: typeof data.reason === 'string' ? data.reason : '',
            startedAt: toMs(data.startedAt),
            expiresAt: toMs(data.expiresAt),
          }
        })
        setPastSessions(docs)
      },
      (err) => {
        console.error('[BreakGlassPage] Audit log listener error:', err)
        // Non-fatal — audit log is secondary
      },
    )
    return unsub
  }, [])

  function handleActivate() {
    void initiateSession(codeA, codeB, reason)
  }

  const reasonTooShort = reason.trim().length < 50
  const totpInvalid = totpCode.replace(/\D/g, '').length < 6
  const canActivate = !loading && !reasonTooShort && !totpInvalid

  // ── Active session view ──────────────────────────────────────────────────────

  if (active && sessionId !== null && expiresAt !== null) {
    return (
      <main style={PAGE}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: 0 }}>
          Break-Glass Access
        </h1>

        <div
          style={{
            background: '#b91c1c',
            color: '#fff',
            padding: '16px 20px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Shield size={18} />
            <strong style={{ fontSize: '15px' }}>Break-Glass session ACTIVE</strong>
          </div>
          <p style={{ margin: '0 0 4px', fontSize: '13px', opacity: 0.9 }}>
            Session ID: <code style={{ fontFamily: 'monospace' }}>{sessionId}</code>
          </p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, fontFamily: 'monospace' }}>
            {timeLeft}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>remaining</p>
        </div>

        {error !== null && (
          <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: '14px' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => void deactivateSession()}
          style={{
            ...BTN_RED,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {loading ? 'Deactivating…' : 'Deactivate Session'}
        </button>

        <AuditLogTable sessions={pastSessions} />
      </main>
    )
  }

  // ── Activation form ──────────────────────────────────────────────────────────

  return (
    <main style={PAGE}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: 0 }}>
        Break-Glass Access
      </h1>

      {/* Purpose explanation */}
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '14px 18px',
          color: '#b91c1c',
          fontSize: '14px',
          lineHeight: 1.6,
        }}
      >
        Break-glass access grants temporary full data access for 72 hours. All actions are logged
        and require independent review. Use only in genuine emergencies where normal access controls
        prevent critical incident response.
      </div>

      <div style={CARD}>
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '12px',
            color: '#6b7280',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '4px',
            padding: '8px 10px',
          }}
        >
          All actions audit-streamed · Dual-control required · Auto-expiry enforced
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="code-a" style={LABEL}>
              Controller A code
            </label>
            <input
              id="code-a"
              type="password"
              value={codeA}
              onChange={(e) => {
                setCodeA(e.target.value)
              }}
              autoComplete="off"
              style={INPUT}
            />
          </div>

          <div>
            <label htmlFor="code-b" style={LABEL}>
              Controller B code
            </label>
            <input
              id="code-b"
              type="password"
              value={codeB}
              onChange={(e) => {
                setCodeB(e.target.value)
              }}
              autoComplete="off"
              style={INPUT}
            />
          </div>

          <div>
            <label htmlFor="bg-reason" style={LABEL}>
              Reason (required — minimum 50 characters)
            </label>
            <textarea
              id="bg-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              rows={4}
              style={{ ...INPUT, resize: 'vertical' }}
              placeholder="Describe the emergency requiring break-glass access. Be specific about the incident and why normal access controls cannot be used."
            />
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '12px',
                color: reasonTooShort && reason.length > 0 ? '#b91c1c' : '#9ca3af',
              }}
            >
              {String(reason.trim().length)} / 50 characters minimum
            </p>
          </div>

          <div>
            <label htmlFor="bg-totp" style={LABEL}>
              TOTP Verification Code
            </label>
            <input
              id="bg-totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }}
              autoComplete="one-time-code"
              style={{
                ...INPUT,
                letterSpacing: '0.3em',
                fontFamily: 'monospace',
                fontSize: '18px',
              }}
              placeholder="000000"
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              6-digit code from your authenticator app. MFA is enforced server-side.
            </p>
          </div>

          <div
            style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#92400e',
            }}
          >
            This declaration will be audit-logged permanently and will trigger an independent
            review. Activate only when authorized.
          </div>

          {error !== null && (
            <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '14px' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canActivate}
            onClick={handleActivate}
            style={{
              ...BTN_RED,
              opacity: canActivate ? 1 : 0.5,
              cursor: canActivate ? 'pointer' : 'not-allowed',
              alignSelf: 'flex-start',
            }}
          >
            {loading ? 'Activating…' : 'Activate Break-Glass'}
          </button>
        </div>
      </div>

      <AuditLogTable sessions={pastSessions} />
    </main>
  )
}

// ── Audit log table ───────────────────────────────────────────────────────────

function AuditLogTable({ sessions }: { sessions: BreakGlassSession[] }) {
  return (
    <section aria-labelledby="audit-log-heading">
      <h2
        id="audit-log-heading"
        style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 12px' }}
      >
        Past Sessions
      </h2>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflowX: 'auto',
        }}
      >
        {sessions.length === 0 ? (
          <p style={{ margin: 0, padding: '16px 20px', fontSize: '14px', color: '#9ca3af' }}>
            No past break-glass sessions
          </p>
        ) : (
          <table
            aria-label="Past break-glass sessions"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
          >
            <thead>
              <tr>
                <th style={TABLE_TH}>Admin UID</th>
                <th style={TABLE_TH}>Reason</th>
                <th style={TABLE_TH}>Started</th>
                <th style={TABLE_TH}>Expired</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...TABLE_TD, fontFamily: 'monospace', fontSize: '12px' }}>
                    {s.uid}
                  </td>
                  <td style={{ ...TABLE_TD, maxWidth: '260px' }}>
                    {s.reason.length > 80 ? `${s.reason.slice(0, 80)}…` : s.reason}
                  </td>
                  <td style={{ ...TABLE_TD, whiteSpace: 'nowrap' }}>
                    {s.startedAt > 0
                      ? new Date(s.startedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
                      : '—'}
                  </td>
                  <td style={{ ...TABLE_TD, whiteSpace: 'nowrap' }}>
                    {s.expiresAt > 0
                      ? new Date(s.expiresAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
