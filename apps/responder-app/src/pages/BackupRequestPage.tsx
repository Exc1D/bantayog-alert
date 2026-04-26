import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRequestBackup } from '../hooks/useRequestBackup'

export function BackupRequestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { request, loading, error } = useRequestBackup(id ?? '')

  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) return
    try {
      await request(trimmed)
      setSubmitted(true)
    } catch {
      // error surfaced by hook
    }
  }

  if (submitted) {
    return (
      <main>
        <h1>Backup requested</h1>
        <p>Your backup request has been submitted.</p>
        <button
          onClick={() => {
            void navigate(`/dispatches/${id ?? ''}`)
          }}
        >
          Back to dispatch
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>Request Backup</h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label htmlFor="reason">Reason (required)</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
            }}
            placeholder="Why do you need backup?"
            rows={3}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error.message}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Request backup'}
        </button>
        <button
          type="button"
          onClick={() => {
            void navigate(`/dispatches/${id ?? ''}`)
          }}
          disabled={loading}
        >
          Cancel
        </button>
      </form>
    </main>
  )
}
