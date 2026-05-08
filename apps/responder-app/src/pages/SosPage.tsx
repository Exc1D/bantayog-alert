import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useTriggerSOS } from '../hooks/useTriggerSOS'
import styles from './SosPage.module.css'

export function SosPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const navigate = useNavigate()
  const { trigger, loading, error } = useTriggerSOS(dispatchId ?? '')

  if (dispatchId === undefined) {
    return (
      <div role="alert" className={styles.invalid}>
        Invalid route: dispatch ID is missing.
      </div>
    )
  }

  const id = dispatchId

  async function handleConfirm() {
    try {
      await trigger()
      void navigate(`/dispatches/${id}`)
    } catch (err: unknown) {
      console.error('[SosPage] triggerSOS failed:', err)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.icon} role="img" aria-label="SOS alert">
        <AlertTriangle size={64} aria-hidden="true" />
      </div>
      <h1 className={styles.title}>SOS ACTIVATION</h1>
      <p className={styles.text}>
        This will send an emergency signal to all admins in your municipality and agency.
      </p>
      {error && (
        <p role="alert" aria-live="assertive" className={styles.error}>
          Unable to trigger SOS. Please try again.
        </p>
      )}
      <button onClick={() => void handleConfirm()} disabled={loading} className={styles.confirmBtn}>
        {loading ? 'Sending…' : 'Confirm SOS'}
      </button>
      <button
        onClick={() => void navigate(`/dispatches/${id}`)}
        disabled={loading}
        className={styles.cancelBtn}
      >
        Cancel
      </button>
    </div>
  )
}
