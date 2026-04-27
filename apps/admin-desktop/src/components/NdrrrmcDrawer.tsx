import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'

// ── Types ─────────────────────────────────────────────────────────────────────

type ForwardMethod = 'email' | 'sms' | 'portal'

interface MassAlertRequestItem {
  id: string
  severity: string
  body: string
  requestedByMunicipality: string
  targetType: string
  estimatedReach: number
  createdAt: number
  evidencePack?: {
    linkedReportIds: string[]
    pagasaSignalRef?: string
    notes?: string
  }
}

// Per-item UI state to avoid re-querying after forwarding
interface ItemUiState {
  forwarded: boolean
  referenceNumber: string
  rejected: boolean
}

export interface NdrrrmcDrawerProps {
  open: boolean
  onClose: () => void
}

// ── Styles ────────────────────────────────────────────────────────────────────

const DRAWER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '480px',
  background: '#fff',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
}

const SCROLL_AREA_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const DISCLAIMER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: '12px 20px',
  background: '#fffbeb',
  borderTop: '1px solid #fde68a',
  fontSize: '12px',
  fontWeight: 600,
  color: '#92400e',
}

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  fontSize: '13px',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#6b7280',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '13px',
  boxSizing: 'border-box' as const,
}

const SELECT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '13px',
  background: '#fff',
  boxSizing: 'border-box' as const,
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  padding: '7px 14px',
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const BTN_DANGER_STYLE: React.CSSProperties = {
  padding: '7px 14px',
  background: '#fff',
  color: '#dc2626',
  border: '1px solid #dc2626',
  borderRadius: '5px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const BTN_DISABLED_STYLE: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FORWARD_METHOD_LABELS: Record<ForwardMethod, string> = {
  email: 'Email',
  sms: 'SMS/Text',
  portal: 'Portal Submission',
}

// ── Item card ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: MassAlertRequestItem
  uiState: ItemUiState
  onForwarded: (itemId: string, referenceNumber: string) => void
  onRejected: (itemId: string) => void
}

function ItemCard({ item, uiState, onForwarded, onRejected }: ItemCardProps) {
  const [method, setMethod] = useState<ForwardMethod>('email')
  const [recipient, setRecipient] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [refInput, setRefInput] = useState('')
  const [forwarding, setForwarding] = useState(false)
  const [forwardError, setForwardError] = useState<string | null>(null)

  if (uiState.rejected) {
    return (
      <div style={{ ...CARD_STYLE, borderColor: '#fca5a5', background: '#fff1f2' }}>
        <p style={{ margin: 0, fontWeight: 600, color: '#b91c1c', fontSize: '13px' }}>
          Request dismissed (local)
        </p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '12px' }}>
          No backend rejection was submitted — the item will reappear on next load if not forwarded.
        </p>
      </div>
    )
  }

  if (uiState.forwarded) {
    return (
      <div style={{ ...CARD_STYLE, borderColor: '#6ee7b7', background: '#f0fdf4' }}>
        <p style={{ margin: 0, fontWeight: 600, color: '#166534', fontSize: '13px' }}>
          Forwarded to NDRRMC
        </p>
        <div>
          <p style={LABEL_STYLE}>Reference / Receipt #</p>
          <input
            type="text"
            placeholder="Enter NDRRMC confirmation number (optional)"
            value={uiState.referenceNumber}
            readOnly
            style={{ ...INPUT_STYLE, background: '#f9fafb', color: '#374151' }}
            aria-label="NDRRMC reference number"
          />
        </div>
      </div>
    )
  }

  const handleForward = async () => {
    setForwardError(null)
    setForwarding(true)
    try {
      await callables.forwardMassAlertToNDRRMC({
        requestId: item.id,
        forwardMethod: method,
        ndrrmcRecipient: recipient.trim() || 'ndrrmc@dilg.gov.ph',
      })
      onForwarded(item.id, refInput)
    } catch (err) {
      setForwardError(err instanceof Error ? err.message : 'Forward failed. Try again.')
    } finally {
      setForwarding(false)
    }
  }

  const canForward = !forwarding

  return (
    <div style={CARD_STYLE}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: '14px',
            color: '#111827',
            textTransform: 'capitalize' as const,
          }}
        >
          {item.severity} severity — {item.requestedByMunicipality}
        </span>
        <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
          {formatDate(item.createdAt)}
        </span>
      </div>

      {/* Target */}
      <div>
        <p style={{ ...LABEL_STYLE, marginBottom: '2px' }}>Target scope</p>
        <p style={{ margin: 0, color: '#374151' }}>
          {item.targetType} — est. {item.estimatedReach.toLocaleString()} reached
        </p>
      </div>

      {/* Alert body */}
      <div>
        <p style={{ ...LABEL_STYLE, marginBottom: '2px' }}>Alert message</p>
        <p style={{ margin: 0, color: '#374151', lineHeight: 1.5 }}>{item.body}</p>
      </div>

      {/* Evidence */}
      {item.evidencePack !== undefined && (
        <div>
          <p style={{ ...LABEL_STYLE, marginBottom: '2px' }}>Evidence</p>
          {item.evidencePack.linkedReportIds.length > 0 && (
            <p style={{ margin: '0 0 2px', color: '#374151' }}>
              {String(item.evidencePack.linkedReportIds.length)} linked report
              {item.evidencePack.linkedReportIds.length !== 1 ? 's' : ''}
            </p>
          )}
          {item.evidencePack.pagasaSignalRef !== undefined && (
            <p style={{ margin: '0 0 2px', color: '#374151' }}>
              PAGASA ref: {item.evidencePack.pagasaSignalRef}
            </p>
          )}
          {item.evidencePack.notes !== undefined && (
            <p style={{ margin: 0, color: '#374151', fontStyle: 'italic' }}>
              {item.evidencePack.notes}
            </p>
          )}
        </div>
      )}

      {/* Divider */}
      <hr style={{ margin: '4px 0', borderColor: '#f3f4f6' }} />

      {/* Forward section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label htmlFor={`method-${item.id}`} style={LABEL_STYLE}>
            Forward method
          </label>
          <select
            id={`method-${item.id}`}
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as ForwardMethod)
            }}
            style={{ ...SELECT_STYLE, marginTop: '4px' }}
          >
            {(Object.keys(FORWARD_METHOD_LABELS) as ForwardMethod[]).map((m) => (
              <option key={m} value={m}>
                {FORWARD_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`recipient-${item.id}`} style={LABEL_STYLE}>
            NDRRMC recipient (optional — defaults to ndrrmc@dilg.gov.ph)
          </label>
          <input
            id={`recipient-${item.id}`}
            type="text"
            placeholder="email / phone / portal ID"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value)
            }}
            style={{ ...INPUT_STYLE, marginTop: '4px' }}
            aria-label="NDRRMC recipient"
          />
        </div>

        <div>
          <label htmlFor={`ref-${item.id}`} style={LABEL_STYLE}>
            Receipt / reference # (fill after NDRRMC confirms)
          </label>
          <input
            id={`ref-${item.id}`}
            type="text"
            placeholder="e.g. NDRRMC-2026-0042"
            value={refInput}
            onChange={(e) => {
              setRefInput(e.target.value)
            }}
            style={{ ...INPUT_STYLE, marginTop: '4px' }}
            aria-label="Reference number"
          />
        </div>

        {forwardError !== null && (
          <p style={{ margin: 0, color: '#dc2626', fontSize: '12px' }}>{forwardError}</p>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
          <button
            type="button"
            onClick={() => void handleForward()}
            disabled={!canForward}
            style={canForward ? BTN_PRIMARY_STYLE : { ...BTN_PRIMARY_STYLE, ...BTN_DISABLED_STYLE }}
            aria-busy={forwarding}
          >
            {forwarding ? 'Forwarding…' : 'Forward to NDRRMC'}
          </button>

          {/* Reject section */}
          <div style={{ display: 'flex', flex: 1, gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Reject reason (required)"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
              }}
              style={{ ...INPUT_STYLE, flex: 1 }}
              aria-label="Reject reason"
            />
            <button
              type="button"
              onClick={() => {
                if (rejectReason.trim().length > 0) {
                  onRejected(item.id)
                }
              }}
              disabled={rejectReason.trim().length === 0}
              style={
                rejectReason.trim().length === 0
                  ? { ...BTN_DANGER_STYLE, ...BTN_DISABLED_STYLE }
                  : BTN_DANGER_STYLE
              }
              aria-disabled={rejectReason.trim().length === 0}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function NdrrrmcDrawer({ open, onClose }: NdrrrmcDrawerProps) {
  const [items, setItems] = useState<MassAlertRequestItem[]>([])
  const [uiStates, setUiStates] = useState<Record<string, ItemUiState>>({})
  const [loading, setLoading] = useState(true)
  const [queryError, setQueryError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset must be synchronous before onSnapshot fires
    setLoading(true)

    setQueryError(null)

    const q = query(
      collection(db, 'mass_alert_requests'),
      where('status', '==', 'pending_ndrrmc_review'),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: MassAlertRequestItem[] = snap.docs.map((d) => {
          const data = d.data()
          const raw = data.evidencePack
          const hasEvidencePack =
            raw !== null &&
            typeof raw === 'object' &&
            Array.isArray((raw as Record<string, unknown>).linkedReportIds)
          const base: MassAlertRequestItem = {
            id: d.id,
            severity: typeof data.severity === 'string' ? data.severity : 'unknown',
            body: typeof data.body === 'string' ? data.body : '',
            requestedByMunicipality:
              typeof data.requestedByMunicipality === 'string' ? data.requestedByMunicipality : '',
            targetType: typeof data.targetType === 'string' ? data.targetType : '',
            estimatedReach: typeof data.estimatedReach === 'number' ? data.estimatedReach : 0,
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          }
          if (hasEvidencePack) {
            base.evidencePack = raw as {
              linkedReportIds: string[]
              pagasaSignalRef?: string
              notes?: string
            }
          }
          return base
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
  }, [open])

  const handleForwarded = (itemId: string, referenceNumber: string) => {
    setUiStates((prev) => ({
      ...prev,
      [itemId]: { forwarded: true, referenceNumber, rejected: false },
    }))
  }

  const handleRejected = (itemId: string) => {
    setUiStates((prev) => ({
      ...prev,
      [itemId]: { forwarded: false, referenceNumber: '', rejected: true },
    }))
  }

  if (!open) return null

  const pendingItems = items.filter((item) => !uiStates[item.id]?.rejected)

  return (
    <div role="dialog" aria-modal="true" aria-label="NDRRMC Escalation Drawer" style={DRAWER_STYLE}>
      {/* Header */}
      <div style={HEADER_STYLE}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
          NDRRMC Escalation Queue
        </h2>
        <button
          type="button"
          aria-label="Close NDRRMC drawer"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6b7280',
            lineHeight: 1,
            padding: '4px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Scrollable content */}
      <div style={SCROLL_AREA_STYLE}>
        {loading && (
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Loading escalation queue…</p>
        )}

        {!loading && queryError !== null && (
          <div
            role="alert"
            style={{
              padding: '12px',
              background: '#fff1f2',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            Failed to load queue: {queryError}
          </div>
        )}

        {!loading && queryError === null && pendingItems.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            No items pending NDRRMC review.
          </p>
        )}

        {!loading &&
          items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              uiState={
                uiStates[item.id] ?? { forwarded: false, referenceNumber: '', rejected: false }
              }
              onForwarded={handleForwarded}
              onRejected={handleRejected}
            />
          ))}
      </div>

      {/* Sticky disclaimer — always visible */}
      <div style={DISCLAIMER_STYLE} role="note" aria-live="polite">
        ⚠️ Escalation submitted to NDRRMC ≠ ECBS alert sent
      </div>
    </div>
  )
}
