import { useState } from 'react'
import { callables } from '../services/callables'

type CancelReason =
  | 'responder_unavailable'
  | 'duplicate_report'
  | 'admin_error'
  | 'citizen_withdrew'

const REASONS: CancelReason[] = [
  'responder_unavailable',
  'duplicate_report',
  'admin_error',
  'citizen_withdrew',
]

export function CancelDispatchModal({
  dispatchId,
  currentStatus,
  onClose,
  onError,
}: {
  dispatchId: string
  currentStatus: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [reason, setReason] = useState<CancelReason>('admin_error')
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    setSubmitting(true)
    try {
      await callables.cancelDispatch({
        dispatchId,
        reason,
        idempotencyKey: crypto.randomUUID(),
      })
      onClose()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Cancel failed')
      setSubmitting(false)
    }
  }

  const cancellable =
    currentStatus === 'pending' ||
    currentStatus === 'accepted' ||
    currentStatus === 'acknowledged' ||
    currentStatus === 'en_route' ||
    currentStatus === 'on_scene'

  return (
    <div role="dialog" aria-modal="true">
      <h2>Cancel Dispatch</h2>
      <p>This will revert the report back to verified status. The responder will be notified.</p>
      {cancellable ? (
        <>
          <fieldset>
            <legend>Reason</legend>
            {REASONS.map((r) => (
              <label key={r}>
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => {
                    setReason(r)
                  }}
                />
                {r}
              </label>
            ))}
          </fieldset>
          <button disabled={submitting} onClick={() => void confirm()}>
            {submitting ? 'Cancelling…' : 'Cancel Dispatch'}
          </button>
        </>
      ) : (
        <p>
          Dispatch in <strong>{currentStatus}</strong> cannot be cancelled (only{' '}
          {REASONS.slice(0, -1).join(', ')} or {REASONS[REASONS.length - 1]} from{' '}
          pending/accepted/acknowledged/en_route/on_scene).
        </p>
      )}
      <button onClick={onClose}>Keep Dispatch</button>
    </div>
  )
}
