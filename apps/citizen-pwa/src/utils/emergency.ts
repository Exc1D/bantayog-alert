import type { AlertDoc } from '@bantayog/shared-types'

// Severities that justify Home "emergency" treatment: the calm secondary stack
// recedes and the bell/FAB drop their playful shake. Mirrors the hero's
// high/critical ranking; info/low/medium advisories must not trip it.
const EMERGENCY_SEVERITIES: ReadonlySet<AlertDoc['severity']> = new Set(['high', 'critical'])

export function hasEmergencyAlert(alerts: readonly AlertDoc[]): boolean {
  return alerts.some((alert) => EMERGENCY_SEVERITIES.has(alert.severity))
}
