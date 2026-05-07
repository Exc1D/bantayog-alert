import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert, CheckCircle, Clock } from 'lucide-react'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { toMs } from '../lib/timestamps'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NdrrmcEscalation {
  id: string
  status: 'pending_review' | 'forwarded' | 'acknowledged'
  message: string
  affectedMunicipalities: string[]
  createdAt: number
  forwardedAt?: number
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '1100px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px 20px',
}

const ROW_BASE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '14px 16px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  transition: 'border-color 150ms',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  margin: '0 0 10px',
}

const BTN_PRIMARY: React.CSSProperties = {
  padding: '8px 18px',
  background: '#001e40',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const BTN_DISABLED: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  pending_review: {
    background: '#fef3c7',
    color: '#92400e',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  forwarded: {
    background: '#dcfce7',
    color: '#16a34a',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  acknowledged: {
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(epochMs: number): string {
  const diffMs = Date.now() - epochMs
  const h = Math.floor(diffMs / 3600000)
  const m = Math.floor((diffMs % 3600000) / 60000)
  if (h > 0) return `${String(h)}h ${String(m)}m ago`
  return `${String(m)}m ago`
}

// ── Inline review panel ───────────────────────────────────────────────────────

interface ReviewPanelProps {
  item: NdrrmcEscalation
  onClose: () => void
  onForwarded: (id: string) => void
}

function ReviewPanel({ item, onClose, onForwarded }: ReviewPanelProps) {
  const [forwarding, setForwarding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleForward() {
    setForwarding(true)
    setError(null)
    try {
      await callables.forwardMassAlertToNDRRMC({
        requestId: item.id,
        forwardMethod: 'email',
        ndrrmcRecipient: 'ndrrmc@dilg.gov.ph',
      })
      setDone(true)
      onForwarded(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Forward failed. Please try again.')
    } finally {
      setForwarding(false)
    }
  }

  return (
    <div
      style={{
        ...CARD,
        borderColor: '#001e40',
        borderWidth: '1.5px',
        animation: 'slideDown 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1d1d1f' }}>
          Review Escalation
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close review panel"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#6b7280',
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <p
            style={{
              margin: '0 0 2px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
            }}
          >
            Affected Municipalities
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#1d1d1f' }}>
            {item.affectedMunicipalities.join(', ')}
          </p>
        </div>

        <div>
          <p
            style={{
              margin: '0 0 2px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
            }}
          >
            Full Message
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>
            {item.message}
          </p>
        </div>

        <div>
          <p
            style={{
              margin: '0 0 2px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
            }}
          >
            Escalated
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
            {timeSince(item.createdAt)}
          </p>
        </div>

        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#92400e',
          }}
        >
          Forwarding will be permanently logged. NDRRMC will be notified via email.
        </div>

        {error !== null && (
          <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
            {error}
          </p>
        )}

        {done ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
            Forwarded to NDRRMC successfully.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => void handleForward()}
              disabled={forwarding}
              aria-label="Forward to NDRRMC"
              style={forwarding ? { ...BTN_PRIMARY, ...BTN_DISABLED } : BTN_PRIMARY}
            >
              {forwarding ? 'Forwarding…' : 'Forward to NDRRMC'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                background: '#fff',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Escalation row ────────────────────────────────────────────────────────────

interface EscalationRowProps {
  item: NdrrmcEscalation
  selected: boolean
  onClick: () => void
}

function EscalationRow({ item, selected, onClick }: EscalationRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ROW_BASE,
        borderColor: selected ? '#001e40' : '#e5e7eb',
        background: selected ? '#f0f4f8' : '#fff',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TriangleAlert size={14} color="#a73400" />
          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>
            {item.id}
          </span>
        </div>
        <span style={STATUS_BADGE[item.status] ?? STATUS_BADGE.pending_review}>
          {item.status === 'pending_review' ? 'Pending' : item.status}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '14px', color: '#1d1d1f', lineHeight: 1.4 }}>
        {item.message.length > 120 ? `${item.message.slice(0, 120)}…` : item.message}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: '#6b7280',
          fontSize: '12px',
        }}
      >
        <Clock size={11} />
        <span>{timeSince(item.createdAt)}</span>
        <span style={{ marginLeft: '8px' }}>
          {item.affectedMunicipalities.slice(0, 3).join(', ')}
          {item.affectedMunicipalities.length > 3
            ? ` +${String(item.affectedMunicipalities.length - 3)} more`
            : ''}
        </span>
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProvinceNdrrmcPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NdrrmcEscalation[]>([])
  const [loading, setLoading] = useState(true)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [forwardedIds, setForwardedIds] = useState<Set<string>>(new Set())

  // Global keyboard shortcut: N navigates to this page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === 'n' || e.key === 'N') {
        void navigate('/province/ndrrmc')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [navigate])

  // Live subscription to pending_review escalations
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const q = query(collection(db, 'ndrrmc_escalations'), where('status', '==', 'pending_review'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: NdrrmcEscalation[] = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            status: (data.status as NdrrmcEscalation['status'] | undefined) ?? 'pending_review',
            message: typeof data.message === 'string' ? data.message : '',
            affectedMunicipalities: Array.isArray(data.affectedMunicipalities)
              ? (data.affectedMunicipalities as string[])
              : [],
            createdAt: toMs(data.createdAt),
            ...(data.forwardedAt !== undefined ? { forwardedAt: toMs(data.forwardedAt) } : {}),
          }
        })
        setItems(docs)
        setLoading(false)
      },
      (err) => {
        setQueryError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const pendingItems = items.filter((i) => !forwardedIds.has(i.id))
  const forwardedItems = items.filter((i) => forwardedIds.has(i.id))
  const selectedItem = items.find((i) => i.id === selectedId) ?? null

  function handleForwarded(id: string) {
    setForwardedIds((prev) => new Set([...prev, id]))
    setSelectedId(null)
  }

  return (
    <main style={PAGE}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
          NDRRMC Escalation Queue
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Review and forward escalated alerts to the National Disaster Risk Reduction and Management
          Council. Keyboard shortcut: N
        </p>
      </div>

      {queryError !== null && (
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
          Failed to load escalations: {queryError}
        </div>
      )}

      {loading && <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading escalation queue…</p>}

      {!loading && queryError === null && (
        <>
          {/* Pending section */}
          <section aria-labelledby="pending-heading">
            <p id="pending-heading" style={SECTION_LABEL}>
              Pending Review ({String(pendingItems.length)})
            </p>

            {pendingItems.length === 0 && (
              <div
                style={{
                  ...CARD,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#6b7280',
                }}
              >
                <CheckCircle size={20} color="#16a34a" />
                <p style={{ margin: 0, fontSize: '14px' }}>No pending NDRRMC escalations</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingItems.map((item) => (
                <div key={item.id}>
                  <EscalationRow
                    item={item}
                    selected={selectedId === item.id}
                    onClick={() => {
                      setSelectedId((prev) => (prev === item.id ? null : item.id))
                    }}
                  />
                  {selectedId === item.id && selectedItem !== null && (
                    <div style={{ marginTop: '8px' }}>
                      <ReviewPanel
                        item={selectedItem}
                        onClose={() => {
                          setSelectedId(null)
                        }}
                        onForwarded={handleForwarded}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Forwarded section */}
          {forwardedItems.length > 0 && (
            <section aria-labelledby="forwarded-heading">
              <p id="forwarded-heading" style={SECTION_LABEL}>
                Forwarded This Session ({String(forwardedItems.length)})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {forwardedItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      ...CARD,
                      borderColor: '#6ee7b7',
                      background: '#f0fdf4',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <CheckCircle size={16} color="#16a34a" />
                    <span style={{ fontSize: '13px', color: '#374151', fontFamily: 'monospace' }}>
                      {item.id}
                    </span>
                    <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                      Forwarded
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
                      {timeSince(item.createdAt)} escalated
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
