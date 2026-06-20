import type { ComponentType } from 'react'
import { getSeverityPresentation } from './status-registry.js'

export interface SeverityStyle {
  fg: string
  bg: string
  label: string
  dotHex: string
  icon: ComponentType<{ size?: number; className?: string }>
}

export function getSeverityStyle(severity: string): SeverityStyle {
  return getSeverityPresentation(severity)
}
