import { useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useDispatchHistory } from '../hooks/useDispatchHistory'
import styles from './DispatchHistoryPage.module.css'

const STATUS_LABEL: Record<string, string> = {
  resolved: '✅ Resolved',
  declined: '✗ Declined',
  timed_out: '⏱ Timed Out',
  cancelled: '✗ Cancelled',
  unable_to_complete: '⚠ Unable to Complete',
}

export function DispatchHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { history, loading } = useDispatchHistory(user?.uid)

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
        <h1 className={styles.headerTitle}>Dispatch History</h1>
      </div>
      <div className={styles.body}>
        {loading && <p className={styles.empty}>Loading…</p>}
        {!loading && history.length === 0 && (
          <p className={styles.empty}>No completed dispatches yet.</p>
        )}
        {history.map((row) => (
          <div key={row.dispatchId} className={styles.row}>
            <div className={styles.rowStatus}>{STATUS_LABEL[row.status] ?? row.status}</div>
            <div className={styles.rowMeta}>
              Report #{row.reportId.slice(0, 8)} ·{' '}
              {new Date(row.dispatchedAt).toLocaleDateString('en-PH')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
