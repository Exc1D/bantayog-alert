import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import styles from './ShiftHandoffPage.module.css'

export function ShiftHandoffPage() {
  const navigate = useNavigate()
  const [targetUid, setTargetUid] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    if (!targetUid.trim() || !reason.trim()) {
      setError('Target responder UID and reason are required.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const fn = httpsCallable<
        { toUid: string; reason: string; idempotencyKey: string },
        { success: boolean }
      >(functions, 'initiateResponderHandoff')
      await fn({
        toUid: targetUid.trim(),
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Handoff failed.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={() => void navigate('/profile')}
            aria-label="Back"
          >
            ←
          </button>
          <h1 className={styles.headerTitle}>Shift Handoff</h1>
        </div>
        <div className={[styles.body, styles.successBody].filter(Boolean).join(' ')}>
          <p className={styles.successIcon} aria-hidden="true">
            ✅
          </p>
          <p className={styles.successTitle}>Handoff submitted successfully.</p>
          <p className={styles.successText}>The incoming responder will be notified.</p>
          <button className={styles.successBtn} onClick={() => void navigate('/profile')}>
            Back to Profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => void navigate('/profile')}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className={styles.headerTitle}>Shift Handoff</h1>
      </div>
      <form
        className={styles.body}
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
      >
        <div className={styles.card}>
          <div className={styles.field}>
            <label htmlFor="handoff-target" className={styles.label}>
              Target Responder UID
            </label>
            <input
              id="handoff-target"
              type="text"
              value={targetUid}
              onChange={(e) => {
                setTargetUid(e.target.value)
              }}
              placeholder="Incoming responder's UID"
              required
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="handoff-reason" className={styles.label}>
              Handoff Notes
            </label>
            <textarea
              id="handoff-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              placeholder="Patient at Brgy. San Jose needs follow-up. Truck is fueled."
              rows={4}
              required
              className={styles.textarea}
            />
          </div>
          {error !== null && (
            <p role="alert" className={styles.errorMsg}>
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Submitting…' : 'Submit Handoff'}
          </button>
        </div>
      </form>
    </div>
  )
}
