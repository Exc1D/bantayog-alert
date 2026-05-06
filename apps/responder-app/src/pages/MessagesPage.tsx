import { Link } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import styles from './MessagesPage.module.css'

function statusSubLabel(uiStatus: string | undefined): string {
  if (uiStatus === 'heading_to_scene') return 'En Route'
  if (uiStatus === 'on_scene') return 'On Scene'
  if (uiStatus === 'pending') return 'Pending acceptance'
  return uiStatus ?? ''
}

export function MessagesPage() {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const allActive = [...groups.pending, ...groups.active]

  return (
    <div className={styles.page}>
      <h1 className={styles.pageHeading}>Messages</h1>
      {allActive.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No active dispatches — messages will appear here.</p>
        </div>
      ) : (
        allActive.map((row) => (
          <Link key={row.dispatchId} to={`/messages/${row.reportId}`} className={styles.threadCard}>
            <span className={styles.threadIcon} aria-hidden="true">
              💬
            </span>
            <div className={styles.threadInfo}>
              <h2 className={styles.threadTitle}>Incident #{row.reportId.slice(0, 8)}</h2>
              <span className={styles.threadSub}>{statusSubLabel(row.uiStatus)}</span>
            </div>
            <span className={styles.threadArrow} aria-hidden="true">
              ›
            </span>
          </Link>
        ))
      )}
    </div>
  )
}
