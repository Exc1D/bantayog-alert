import { useState } from 'react'
import { callables } from '../services/callables'

export function CloseReportModal({
  reportId,
  onClose,
  onError,
}: {
  reportId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    setSubmitting(true)
    try {
      const trimmed = summary.trim()
      await callables.closeReport({
        reportId,
        idempotencyKey: crypto.randomUUID(),
        ...(trimmed ? { closureSummary: trimmed } : {}),
      })
      onClose()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Close failed')
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true">
      <h2>Close Report</h2>
      <p>
        This will archive the report. Only close a report after the incident has been fully resolved
        by responders.
      </p>
      <label>
        Closure summary (optional)
        <textarea
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value)
          }}
          maxLength={2000}
          rows={3}
        />
      </label>
      <button disabled={submitting} onClick={() => void confirm()}>
        {submitting ? 'Closing…' : 'Close Report'}
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}
