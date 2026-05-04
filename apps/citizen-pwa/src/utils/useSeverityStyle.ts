import { AlertTriangle, Bell, Info } from 'lucide-react'
import type { ComponentType } from 'react'

export interface SeverityStyle {
  fg: string
  bg: string
  label: string
  dotHex: string
  icon: ComponentType<{ size?: number; className?: string }>
}

const SEVERITY_MAP: Record<string, SeverityStyle> = {
  high: {
    fg: 'var(--color-severity-high-fg)',
    bg: 'var(--color-severity-high-bg)',
    label: 'HIGH',
    dotHex: '#dc2626',
    icon: AlertTriangle,
  },
  medium: {
    fg: 'var(--color-severity-medium-fg)',
    bg: 'var(--color-severity-medium-bg)',
    label: 'MEDIUM',
    dotHex: '#a73400',
    icon: Bell,
  },
  low: {
    fg: 'var(--color-severity-low-fg)',
    bg: 'var(--color-severity-low-bg)',
    label: 'LOW',
    dotHex: '#414849',
    icon: Info,
  },
}

const DEFAULT: SeverityStyle = {
  fg: 'var(--color-severity-low-fg)',
  bg: 'var(--color-severity-low-bg)',
  label: 'INFO',
  dotHex: '#414849',
  icon: Info,
}

export function getSeverityStyle(severity: string): SeverityStyle {
  return SEVERITY_MAP[severity] ?? DEFAULT
}
