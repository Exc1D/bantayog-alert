import type { ReportStatus } from '@bantayog/shared-types'

export type ReportAction = 'edit' | 'cancel' | 'request_correction'

const EDITABLE = new Set<ReportStatus>(['new', 'awaiting_verify'])
const CORRECTION = new Set<ReportStatus>([
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'reopened',
])

export function actionsFor(status: ReportStatus): ReportAction[] {
  if (EDITABLE.has(status)) return ['edit', 'cancel']
  if (CORRECTION.has(status)) return ['request_correction']
  return []
}
