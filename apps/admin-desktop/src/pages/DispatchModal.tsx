import { useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useEligibleResponders } from '../hooks/useEligibleResponders'
import { type Freshness } from '../utils/freshness'
import { callables } from '../services/callables'

const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: 'green',
  degraded: 'orange',
  stale: '#c60',
  offline: '#999',
}

export function DispatchModal({
  reportId,
  onClose,
  onError,
}: {
  reportId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const { claims } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const eligible = useEligibleResponders(municipalityId)
  const [picked, setPicked] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
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
    <div role="dialog" aria-modal="true">
      <h2>Dispatch a responder</h2>
      {eligible.length === 0 ? (
        <p>No responders on shift in your municipality.</p>
      ) : (
        <ul>
          {eligible.map((r) => (
            <li key={r.uid}>
              <label>
                <input
                  type="radio"
                  name="responder"
                  value={r.uid}
                  checked={picked === r.uid}
                  onChange={() => {
                    setPicked(r.uid)
                  }}
                />
                {r.displayName} · {r.agencyId}
                <span
                  style={{
                    marginLeft: 8,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#eee',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {r.availabilityStatus}
                </span>
                {r.lastTelemetryAt != null && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: '0.75rem',
                      color: FRESHNESS_COLOR[r.freshness],
                    }}
                  >
                    {r.freshness}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
      <button disabled={!picked || submitting} onClick={() => void confirm()}>
        {submitting ? 'Dispatching…' : 'Confirm'}
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}
