import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRequestBackup } from '../hooks/useRequestBackup'
import styles from './DispatchDetailPage.module.css'

export function BackupRequestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { request, loading, error } = useRequestBackup(id ?? '')

  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!id) {
    return (
      <div role="alert" className={styles.errorMsg}>
        Invalid route: dispatch ID is missing.
      </div>
    )
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) return
    try {
      await request(trimmed)
      setSubmitted(true)
    } catch (err: unknown) {
      console.error('[BackupRequestPage] request failed', err)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button
            className={styles.backBtn}
            onClick={() => void navigate(`/dispatches/${id}`)}
            aria-label="Back"
          >
            ←
          </button>
          <h1 className={styles.pageTitle}>Backup requested</h1>
        </div>
        <div className={styles.body}>
          <div className={styles.statusSection}>
            <p>Your backup request has been submitted.</p>
          </div>
          <button
            className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
            onClick={() => void navigate(`/dispatches/${id}`)}
          >
            Back to dispatch
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button
          className={styles.backBtn}
          onClick={() => void navigate(`/dispatches/${id}`)}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className={styles.pageTitle}>Request Backup</h1>
      </div>

      <div className={styles.body}>
        <form onSubmit={(e) => void handleSubmit(e)} className={styles.statusSection}>
          <div>
            <label htmlFor="reason" className={styles.statusTitle}>
              Reason (required)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              placeholder="Why do you need backup?"
              rows={3}
              required
              className={styles.textarea}
            />
          </div>
          {error && <p className={styles.errorMsg}>{error.message}</p>}
          <div className={styles.quickToggles}>
            <button
              type="submit"
              disabled={loading}
              className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
            >
              {loading ? 'Submitting…' : 'Request backup'}
            </button>
            <button
              type="button"
              onClick={() => void navigate(`/dispatches/${id}`)}
              disabled={loading}
              className={styles.toggleBtn}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
