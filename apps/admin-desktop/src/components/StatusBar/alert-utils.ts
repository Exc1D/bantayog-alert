export type AlertLevel = 'none' | 'amber' | 'red'

export function alertColorClass(alert: AlertLevel): string {
  if (alert === 'red') return 'text-[var(--color-danger)]'
  if (alert === 'amber') return 'text-[var(--color-warning)]'
  return 'text-[var(--color-text-primary)]'
}

export function alertDotColor(alert: AlertLevel): string {
  if (alert === 'red') return 'var(--color-danger)'
  if (alert === 'amber') return 'var(--color-warning)'
  return 'transparent'
}
