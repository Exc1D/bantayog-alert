import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '800px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
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
  marginBottom: '16px',
}

const METRIC_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid #f3f4f6',
}

const METRIC_LABEL_STYLE: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
}

const BTN_STYLE: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthData {
  streamingGapSeconds: number
  batchGapSeconds: number
  healthy: boolean
  checkedAt: Timestamp | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTimestamp(val: unknown): Timestamp | null {
  if (val != null && typeof (val as Timestamp).toDate === 'function') {
    return val as Timestamp
  }
  return null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useSystemHealth(): HealthData | null {
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    const ref = doc(db, 'system_health', 'latest')
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setHealth(null)
        return
      }
      const data = snap.data()
      setHealth({
        streamingGapSeconds:
          typeof data.streamingGapSeconds === 'number' ? data.streamingGapSeconds : 0,
        batchGapSeconds: typeof data.batchGapSeconds === 'number' ? data.batchGapSeconds : 0,
        healthy: data.healthy === true,
        checkedAt: toTimestamp(data.checkedAt),
      })
    })
  }, [])

  return health
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GapValue({ seconds, warnThreshold }: { seconds: number; warnThreshold: number }) {
  const isWarn = seconds > warnThreshold
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize: '20px',
        color: isWarn ? '#dc2626' : '#111827',
      }}
    >
      {seconds}s
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemHealthPage() {
  const health = useSystemHealth()

  return (
    <div style={PAGE_STYLE}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
        System Health
      </h1>

      <div style={CARD_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Audit Pipeline</div>

        {health === null ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>
            No health data available. Waiting for first health check write to{' '}
            <code>system_health/latest</code>.
          </p>
        ) : (
          <>
            <div style={METRIC_ROW_STYLE}>
              <span style={METRIC_LABEL_STYLE}>Overall status</span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: health.healthy ? '#d1fae5' : '#fee2e2',
                  color: health.healthy ? '#065f46' : '#991b1b',
                }}
              >
                {health.healthy ? 'Healthy' : 'Degraded'}
              </span>
            </div>

            <div style={METRIC_ROW_STYLE}>
              <span style={METRIC_LABEL_STYLE}>Streaming audit gap</span>
              {/* Red when gap exceeds 60 seconds */}
              <GapValue seconds={health.streamingGapSeconds} warnThreshold={60} />
            </div>

            <div style={METRIC_ROW_STYLE}>
              <span style={METRIC_LABEL_STYLE}>Batch audit gap</span>
              {/* Red when gap exceeds 900 seconds (15 min) */}
              <GapValue seconds={health.batchGapSeconds} warnThreshold={900} />
            </div>

            <div style={{ ...METRIC_ROW_STYLE, borderBottom: 'none' }}>
              <span style={METRIC_LABEL_STYLE}>Last checked</span>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {health.checkedAt?.toDate().toLocaleString() ?? '—'}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={CARD_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Signal Controls</div>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
          Declare or clear TCWS signal levels. A runbook link is available below for surge pre-warm
          procedures. Signal controls are currently not active in this environment; these buttons
          are placeholders and do not send or clear real signals yet.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            style={{ ...BTN_STYLE, opacity: 0.5, cursor: 'not-allowed' }}
            disabled
            title="Signal controls are not yet active; no real signal will be declared."
          >
            Declare Signal
          </button>
          <button
            style={{ ...BTN_STYLE, opacity: 0.5, cursor: 'not-allowed' }}
            disabled
            title="Signal controls are not yet active; no real signal will be cleared."
          >
            Clear Active Signal
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          TCWS signal ≥ 2 active?{' '}
          <a
            href="https://github.com/Exc1D/bantayog-alert/blob/main/infra/runbooks/surge-prewarm.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: '#2563eb' }}
          >
            Surge Runbook
          </a>
        </p>
      </div>

      <div style={CARD_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Operations</div>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
          Replay dead-letter audit events that failed to stream to BigQuery.
        </p>
        <button
          style={BTN_STYLE}
          onClick={() => {
            console.warn('dead-letter replay triggered (stub)')
          }}
        >
          Dead-Letter Replay
        </button>
      </div>
    </div>
  )
}
