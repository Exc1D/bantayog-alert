import styles from './ErrorStates.module.css'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.errorState} data-testid="error-state">
      <svg
        data-testid="error-icon"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
      </svg>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={styles.retryButton}>
          Retry
        </button>
      )}
    </div>
  )
}
