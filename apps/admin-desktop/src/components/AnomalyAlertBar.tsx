import { useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { TriangleAlert, TrendingDown, UserX } from 'lucide-react'
import { db } from '../app/firebase'
import { toMs } from '../lib/timestamps'

// ── Types ─────────────────────────────────────────────────────────────────────

type AnomalyType = 'response_time_spike' | 'resolution_drop' | 'admin_shift_gap'

interface Anomaly {
  id: string
  type: AnomalyType
  municipalityId: string
  description: string
  detectedAt: number
  severity: string
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ROW_STYLES: Record<AnomalyType, React.CSSProperties> = {
  response_time_spike: {
    background: '#fff',
    border: '1px solid #fed7aa',
    borderLeft: '4px solid #b45309',
  },
  resolution_drop: {
    background: '#fef3c7',
    border: '1px solid #fde68a',
    borderLeft: '4px solid #92400e',
  },
  admin_shift_gap: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderLeft: '4px solid #991b1b',
  },
}

const TEXT_STYLES: Record<AnomalyType, React.CSSProperties> = {
  response_time_spike: { color: '#b45309' },
  resolution_drop: { color: '#92400e' },
  admin_shift_gap: { color: '#991b1b' },
}

const ICON_COLOR: Record<AnomalyType, string> = {
  response_time_spike: '#b45309',
  resolution_drop: '#92400e',
  admin_shift_gap: '#991b1b',
}

function AnomalyIcon({ type }: { type: AnomalyType }) {
  const color = ICON_COLOR[type]
  switch (type) {
    case 'response_time_spike':
      return <TriangleAlert size={15} color={color} aria-hidden="true" />
    case 'resolution_drop':
      return <TrendingDown size={15} color={color} aria-hidden="true" />
    case 'admin_shift_gap':
      return <UserX size={15} color={color} aria-hidden="true" />
  }
}

function formatRelative(epochMs: number): string {
  const diffMs = Date.now() - epochMs
  const m = Math.floor(diffMs / 60000)
  if (m < 60) return `${String(m)}m ago`
  const h = Math.floor(m / 60)
  return `${String(h)}h ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnomalyAlertBar() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  useEffect(() => {
    const q = query(collection(db, 'anomalies'), orderBy('detectedAt', 'desc'), limit(20))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: Anomaly[] = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            type: (data.type as AnomalyType | undefined) ?? 'response_time_spike',
            municipalityId: typeof data.municipalityId === 'string' ? data.municipalityId : '',
            description: typeof data.description === 'string' ? data.description : '',
            detectedAt: toMs(data.detectedAt),
            severity: typeof data.severity === 'string' ? data.severity : '',
          }
        })
        setAnomalies(docs)
      },
      () => {
        // Silently ignore — non-critical UI element
      },
    )
    return unsub
  }, [])

  const visible = anomalies.filter((a) => !dismissing.has(a.id))

  if (visible.length === 0) return null

  async function dismiss(id: string) {
    setDismissing((prev) => new Set([...prev, id]))
    try {
      await updateDoc(doc(db, 'anomalies', id), { status: 'dismissed' })
    } catch {
      // Rollback optimistic dismiss if write fails
      setDismissing((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <section
      aria-label="Anomaly alerts"
      style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      {visible.map((a) => {
        const rowStyle = ROW_STYLES[a.type]
        const textStyle = TEXT_STYLES[a.type]
        return (
          <div
            key={a.id}
            style={{
              ...rowStyle,
              borderRadius: '6px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AnomalyIcon type={a.type} />
            <span style={{ ...textStyle, fontWeight: 700, fontSize: '13px', minWidth: '80px' }}>
              {a.municipalityId}
            </span>
            <span style={{ ...textStyle, fontSize: '13px', flex: 1 }}>{a.description}</span>
            <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>
              {formatRelative(a.detectedAt)}
            </span>
            <button
              type="button"
              onClick={() => void dismiss(a.id)}
              aria-label={`Dismiss anomaly for ${a.municipalityId}`}
              style={{
                background: 'none',
                border: '1px solid currentColor',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                color: '#6b7280',
                whiteSpace: 'nowrap',
              }}
            >
              Dismiss
            </button>
          </div>
        )
      })}
    </section>
  )
}
