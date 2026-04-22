import type { SubmissionState } from '../../hooks/useSubmissionMachine.js'
import { MAX_RETRIES } from '../../hooks/useSubmissionMachine.js'

const BANNER_CONFIG: Partial<Record<SubmissionState, { message: string; bg: string; fg: string }>> =
  {
    submitting: {
      message: 'Sending\u2026',
      bg: 'var(--color-surface)',
      fg: 'var(--color-primary)',
    },
    server_confirmed: {
      message: 'Received!',
      bg: 'var(--color-success-bg)',
      fg: 'var(--color-success-fg)',
    },
    queued: {
      message: 'Offline \u2014 will send when connected',
      bg: 'var(--color-queued-bg)',
      fg: 'var(--color-queued-fg)',
    },
    failed_retryable: {
      message: 'Send failed \u2014 retrying\u2026',
      bg: 'var(--color-queued-bg)',
      fg: 'var(--color-queued-fg)',
    },
    failed_terminal: {
      message: 'Could not send. Try SMS or contact hotline.',
      bg: 'var(--color-failed-bg)',
      fg: 'var(--color-failed-fg)',
    },
  }

interface OfflineBannerProps {
  state: SubmissionState
  retryCount: number
}

export function OfflineBanner({ state, retryCount }: OfflineBannerProps) {
  const config = BANNER_CONFIG[state]
  if (!config) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: config.bg,
        color: config.fg,
        fontWeight: 600,
        marginBottom: 'var(--spacing-md)',
      }}
    >
      {config.message}
      {state === 'failed_retryable' && retryCount > 0 && (
        <span style={{ marginLeft: 'var(--spacing-sm)', opacity: 0.8 }}>
          (attempt {String(retryCount)}/{String(MAX_RETRIES)})
        </span>
      )}
      {state === 'submitting' && (
        <span aria-hidden="true" style={{ marginLeft: 'var(--spacing-sm)' }}>
          &bull;&bull;&bull;
        </span>
      )}
    </div>
  )
}
