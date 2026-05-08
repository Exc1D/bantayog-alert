import { useState, useRef, useEffect } from 'react'
import { callables } from '../services/callables'

export function ReopenReportModal({
  reportId,
  onClose,
  onError,
}: {
  reportId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await callables.reopenReport({
        reportId,
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      onClose()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Reopen failed')
      setSubmitting(false)
    }
  }

  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reopen-title"
      tabIndex={-1}
    >
      <h2 id="reopen-title">Reopen Report</h2>
      <p>This will reopen a closed report and return it to active status.</p>
      <label htmlFor="reopen-reason">Reason</label>
      <textarea
        id="reopen-reason"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
        }}
        rows={3}
        placeholder="Reason for reopening…"
      />
      <button disabled={!reason.trim() || submitting} onClick={() => void confirm()}>
        {submitting ? 'Reopening…' : 'Reopen Report'}
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}
