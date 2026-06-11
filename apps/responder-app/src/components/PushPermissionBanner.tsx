import type { CSSProperties } from 'react'

export type PushPermissionBannerPermission = Extract<NotificationPermission, 'default' | 'denied'>

interface PushPermissionBannerProps {
  permission: PushPermissionBannerPermission
  onDismiss: () => void
  onRetry: () => void | Promise<void>
  isRetrying?: boolean
}

const styles = {
  banner: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    width: '100%',
    borderBottom: '1px solid rgba(167, 52, 0, 0.45)',
    background: '#1f1712',
    color: 'var(--text-primary)',
    padding: '0.875rem 1rem',
  },
  content: {
    maxWidth: '52rem',
    margin: '0 auto',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  copy: {
    minWidth: '16rem',
    flex: '1 1 18rem',
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  message: {
    margin: '0.25rem 0 0',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 'var(--touch-target-min)',
    borderRadius: '0.5rem',
    border: '1px solid rgba(241, 245, 249, 0.18)',
    padding: '0.625rem 0.875rem',
    color: 'var(--text-primary)',
    background: 'rgba(241, 245, 249, 0.08)',
    cursor: 'pointer',
  },
  primaryButton: {
    background: 'var(--amber-accent)',
    borderColor: 'var(--amber-accent)',
  },
} satisfies Record<string, CSSProperties>

export function PushPermissionBanner({
  permission,
  onDismiss,
  onRetry,
  isRetrying = false,
}: PushPermissionBannerProps) {
  const isDenied = permission === 'denied'
  const title = isDenied
    ? 'Dispatch push notifications are blocked'
    : 'Dispatch push notifications are not enabled'
  const message = isDenied
    ? 'Your browser is blocking dispatch notifications. Open browser settings for this site and allow notifications so urgent dispatches can reach you.'
    : 'Enable notifications on this device so urgent dispatches can reach you while the app is backgrounded.'

  return (
    <section role="alert" aria-atomic="true" style={styles.banner}>
      <div style={styles.content}>
        <div style={styles.copy}>
          <p style={styles.title}>{title}</p>
          <p style={styles.message}>{message}</p>
        </div>
        <div style={styles.actions}>
          {!isDenied ? (
            <button
              type="button"
              onClick={() => {
                void onRetry()
              }}
              disabled={isRetrying}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              {isRetrying ? 'Enabling...' : 'Enable notifications'}
            </button>
          ) : null}
          <button type="button" onClick={onDismiss} style={styles.button}>
            Dismiss
          </button>
        </div>
      </div>
    </section>
  )
}
