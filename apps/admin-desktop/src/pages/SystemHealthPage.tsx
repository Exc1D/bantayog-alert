import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { cn } from '@/lib/utils'
import styles from './SystemHealthPage.module.css'

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
  return <span className={isWarn ? styles.gapValueWarn : styles.gapValueOk}>{seconds}s</span>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemHealthPage() {
  const health = useSystemHealth()
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayResult, setReplayResult] = useState<string | null>(null)
  const [prewarmLoading, setPrewarmLoading] = useState(false)
  const [prewarmResult, setPrewarmResult] = useState<string | null>(null)

  const handleReplay = async () => {
    setReplayLoading(true)
    setReplayResult(null)
    try {
      const result = await callables.replayDeadLetter()
      setReplayResult(`Replayed ${String(result.replayed)} dead-letter event(s).`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Replay failed'
      setReplayResult(`Error: ${message}`)
    } finally {
      setReplayLoading(false)
    }
  }

  const handlePrewarm = async (level: 'light' | 'heavy') => {
    setPrewarmLoading(true)
    setPrewarmResult(null)
    try {
      const result = await callables.prewarmSurge({ level })
      setPrewarmResult(`Warmed ${String(result.warmed)} function(s).`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pre-warm failed'
      setPrewarmResult(`Error: ${message}`)
    } finally {
      setPrewarmLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>System Health</h1>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>Audit Pipeline</div>

        {health === null ? (
          <p className={styles.infoText}>
            No health data available. Waiting for first health check write to{' '}
            <code>system_health/latest</code>.
          </p>
        ) : (
          <>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Overall status</span>
              <span
                className={cn(
                  styles.statusBadge,
                  health.healthy ? styles.statusHealthy : styles.statusDegraded,
                )}
              >
                {health.healthy ? 'Healthy' : 'Degraded'}
              </span>
            </div>

            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Streaming audit gap</span>
              {/* Red when gap exceeds 60 seconds */}
              <GapValue seconds={health.streamingGapSeconds} warnThreshold={60} />
            </div>

            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Batch audit gap</span>
              {/* Red when gap exceeds 900 seconds (15 min) */}
              <GapValue seconds={health.batchGapSeconds} warnThreshold={900} />
            </div>

            <div className={styles.metricRowLast}>
              <span className={styles.metricLabel}>Last checked</span>
              <span className={styles.checkedAtText}>
                {health.checkedAt?.toDate().toLocaleString() ?? '—'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>Operations</div>
        <p className={styles.descText}>
          Replay dead-letter audit events that failed to stream to BigQuery.
        </p>
        <button
          className={cn(styles.btn, replayLoading && styles.btnDisabled)}
          disabled={replayLoading}
          onClick={() => {
            void handleReplay()
          }}
        >
          {replayLoading ? 'Replaying…' : 'Dead-Letter Replay'}
        </button>
        {replayResult && <p className={styles.resultText}>{replayResult}</p>}

        <div className={styles.prewarmSection}>
          <p className={styles.descText}>
            Pre-warm Cloud Functions to reduce cold-start latency during surge events.
          </p>
          <div className={styles.btnRow}>
            <button
              className={cn(styles.btn, prewarmLoading && styles.btnDisabled)}
              disabled={prewarmLoading}
              onClick={() => {
                void handlePrewarm('light')
              }}
            >
              {prewarmLoading ? 'Warming…' : 'Light Warmup'}
            </button>
            <button
              className={cn(styles.btn, prewarmLoading && styles.btnDisabled)}
              disabled={prewarmLoading}
              onClick={() => {
                void handlePrewarm('heavy')
              }}
            >
              {prewarmLoading ? 'Warming…' : 'Heavy Warmup'}
            </button>
          </div>
          {prewarmResult && <p className={styles.resultText}>{prewarmResult}</p>}
        </div>
      </div>
    </div>
  )
}
