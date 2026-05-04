import { getSeverityStyle } from './useSeverityStyle.js'

const CRITICAL_STYLE = {
  label: 'CRITICAL',
  fg: 'var(--color-severity-critical-fg)',
  bg: 'var(--color-severity-critical-bg)',
}

export function severityMeta(severity: string): { label: string; bg: string; color: string } {
  if (severity === 'critical') {
    return { label: CRITICAL_STYLE.label, bg: CRITICAL_STYLE.bg, color: CRITICAL_STYLE.fg }
  }
  const style = getSeverityStyle(severity)
  return { label: style.label, bg: style.bg, color: style.fg }
}
