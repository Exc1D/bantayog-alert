import styles from './EmptyStates.module.css'

export function EmptyTriage() {
  return (
    <div className={styles.emptyState} data-testid="empty-triage">
      <svg
        data-testid="empty-checkmark"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <p className={styles.message}>No active incidents</p>
      <p className={styles.subtext}>System is operating normally</p>
    </div>
  )
}

export function EmptyMap() {
  return (
    <div className={styles.emptyState} data-testid="empty-map">
      <svg
        data-testid="empty-checkmark"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <p className={styles.message}>All Clear</p>
      <p className={styles.subtext}>No active incidents across province</p>
    </div>
  )
}

export function EmptyAnalytics() {
  return (
    <div className={styles.emptyState} data-testid="empty-analytics">
      <svg
        data-testid="empty-icon"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
      <p className={styles.message}>No data for selected time range</p>
      <p className={styles.subtext}>Try adjusting the filters or time period</p>
    </div>
  )
}
