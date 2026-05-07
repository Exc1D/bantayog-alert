import { useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useAgencyResponders } from '../hooks/useAgencyResponders'
import { computeFreshness, type Freshness } from '../utils/freshness'
import { callables } from '../services/callables'

const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: 'green',
  degraded: 'orange',
  stale: '#c60',
  offline: '#999',
}

/**
 * Dispatch modal scoped to the agency admin's own agency.
 * Only on-duty responders from the same agencyId are selectable.
 * Calls dispatchResponder with the responderUid and reportId.
 */
export function AgencyDispatchModal({
  reportId,
  onClose,
  onError,
}: {
  reportId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const { claims } = useAuth()
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : undefined
  const responders = useAgencyResponders(agencyId)
  const [picked, setPicked] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const confirm = async () => {
    if (!picked) return
    setSubmitting(true)
    try {
      await callables.dispatchResponder({
        reportId,
        responderUid: picked,
        idempotencyKey: crypto.randomUUID(),
      })
      onClose()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Dispatch failed')
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-dispatch-title"
      style={{
        padding: 24,
        background: '#ffffff',
        borderRadius: 10,
        border: '1px solid #dfe3e8',
        maxWidth: 480,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}
    >
      <h2
        id="agency-dispatch-title"
        style={{ fontSize: 18, fontWeight: 700, color: '#001e40', marginBottom: 16 }}
      >
        Dispatch a Responder
      </h2>

      {responders.length === 0 ? (
        <div
          style={{
            padding: '24px 0',
            textAlign: 'center',
            color: '#8a9199',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
            No on-duty responders available.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Use Bulk Shift Toggle to bring responders on-duty.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          {responders.map((r) => {
            const freshness = computeFreshness(r.lastTelemetryAt)
            return (
              <li key={r.uid} style={{ marginBottom: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    border: `2px solid ${picked === r.uid ? '#001e40' : '#dfe3e8'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: picked === r.uid ? '#f0f4f8' : '#ffffff',
                  }}
                >
                  <input
                    type="radio"
                    name="agency-responder"
                    value={r.uid}
                    checked={picked === r.uid}
                    aria-label={r.displayName}
                    onChange={() => {
                      setPicked(r.uid)
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1d1d1f' }}>
                      {r.displayName}
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        padding: '2px 6px',
                        borderRadius: 12,
                        background: '#f0f4f8',
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        color: '#556068',
                      }}
                    >
                      {r.availabilityStatus}
                    </span>
                  </div>
                  {r.lastTelemetryAt != null && (
                    <span style={{ fontSize: '0.75rem', color: FRESHNESS_COLOR[freshness] }}>
                      {freshness}
                    </span>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 20px',
            background: '#f0f4f8',
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
        <button
          disabled={!picked || submitting}
          onClick={() => void confirm()}
          style={{
            padding: '8px 20px',
            background: !picked || submitting ? '#a8b5c4' : '#001e40',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: !picked || submitting ? 'not-allowed' : 'pointer',
            minHeight: 44,
            fontSize: 13,
          }}
        >
          {submitting ? 'Dispatching…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
