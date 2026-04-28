import { useEffect, useRef, useState } from 'react'
import { useBreakGlass } from '../hooks/useBreakGlass'

function formatTimeLeft(expiresAt: number): string {
  const diffMs = Math.max(0, expiresAt - Date.now())
  const totalSeconds = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function BreakGlassPage() {
  const { active, sessionId, expiresAt, error, loading, initiateSession, deactivateSession } =
    useBreakGlass()

  const [codeA, setCodeA] = useState('')
  const [codeB, setCodeB] = useState('')
  const [reason, setReason] = useState('')
  const [timeLeft, setTimeLeft] = useState<string>('04:00:00')

  // Tick countdown while session is active
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

  function handleActivate() {
    void initiateSession(codeA, codeB, reason)
  }

  if (active && sessionId !== null && expiresAt !== null) {
    return (
      <div>
        <div
          style={{
            background: '#b91c1c',
            color: '#fff',
            padding: '1rem',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem',
          }}
        >
          <strong>Break-Glass session ACTIVE</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            Session ID: <code style={{ fontFamily: 'monospace' }}>{sessionId}</code>
          </p>
          <p style={{ margin: '0.25rem 0 0' }}>Time remaining: {timeLeft}</p>
        </div>

        {error !== null && (
          <p role="alert" style={{ color: '#b91c1c' }}>
            {error}
          </p>
        )}

        <button disabled={loading} onClick={() => void deactivateSession()}>
          {loading ? 'Deactivating…' : 'Deactivate Session'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '0.375rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          color: '#b91c1c',
        }}
      >
        All actions audit-streamed · Dual-control required · 4h auto-expiry
      </div>

      <h1>Break-Glass Access</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '28rem' }}>
        <label>
          Controller A code
          <br />
          <input
            type="password"
            value={codeA}
            onChange={(e) => {
              setCodeA(e.target.value)
            }}
            autoComplete="off"
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>

        <label>
          Controller B code
          <br />
          <input
            type="password"
            value={codeB}
            onChange={(e) => {
              setCodeB(e.target.value)
            }}
            autoComplete="off"
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>

        <label>
          Reason (required)
          <br />
          <input
            type="text"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
            }}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>

        {error !== null && (
          <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          disabled={
            loading || codeA.length === 0 || codeB.length === 0 || reason.trim().length === 0
          }
          onClick={handleActivate}
        >
          {loading ? 'Activating…' : 'Activate Break-Glass'}
        </button>
      </div>
    </div>
  )
}
