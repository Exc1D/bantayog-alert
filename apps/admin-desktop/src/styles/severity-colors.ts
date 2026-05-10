import type { Severity } from '../types'

export type { Severity }

export const SEVERITY_COLORS: Record<Severity, string> = {
  HIGH: '#a73400',
  MEDIUM: '#c77600',
  LOW: '#414849',
}
