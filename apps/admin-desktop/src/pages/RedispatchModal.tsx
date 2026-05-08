import { useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useEligibleResponders } from '../hooks/useEligibleResponders'
import { computeFreshness, type Freshness } from '../utils/freshness'
import { callables } from '../services/callables'

const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: 'green',
  degraded: 'orange',
  stale: '#c60',
  offline: '#999',
}

export function RedispatchModal({
  oldDispatchId,
  onClose,
  onError,
}: {
  oldDispatchId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const { claims } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const eligible = useEligibleResponders(municipalityId)
  const [picked, setPicked] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    if (!picked || !reason.trim()) return
    setSubmitting(true)
    try {
      await callables.redispatchReport({
        oldDispatchId,
        newResponderUid: picked,
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      onClose()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Redispatch failed')
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true">
      <h2>Redispatch Report</h2>
      <p>The previous dispatch was declined or timed out. Select a new responder.</p>
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
                      color: FRESHNESS_COLOR[computeFreshness(r.lastTelemetryAt)],
                    }}
                  >
                    {computeFreshness(r.lastTelemetryAt)}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 12 }}>
        <label htmlFor="redispatch-reason">Reason</label>
        <textarea
          id="redispatch-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
          }}
          rows={2}
          placeholder="Why is this being redispatched?"
        />
      </div>
      <button disabled={!picked || !reason.trim() || submitting} onClick={() => void confirm()}>
        {submitting ? 'Redispatching…' : 'Redispatch'}
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}
