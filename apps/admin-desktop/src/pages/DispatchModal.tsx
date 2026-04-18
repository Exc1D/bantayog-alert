import { useState } from 'react'
import { useAuth } from '../app/auth-provider'
import { useEligibleResponders } from '../hooks/useEligibleResponders'
import { callables } from '../services/callables'

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
  const eligible = useEligibleResponders(claims?.municipalityId)
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
