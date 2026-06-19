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
  const presentation = getSeverityPresentation(severity)
  return {
    fg: presentation.fg,
    bg: presentation.bg,
    label: presentation.label,
    dotHex: presentation.dotHex,
    icon: presentation.icon,
  }
}
