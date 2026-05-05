import type { ReportStatus } from '@bantayog/shared-types'

export type ReportAction = 'edit' | 'cancel' | 'request_correction'

type EditableStatus = ReportStatus | 'queued'

const EDITABLE = new Set<EditableStatus>(['queued', 'new', 'awaiting_verify'])
const CORRECTION = new Set<ReportStatus>([
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'reopened',
])

export function actionsFor(status: ReportStatus | 'queued'): ReportAction[] {
  if (EDITABLE.has(status)) return ['edit', 'cancel']
  if (CORRECTION.has(status as ReportStatus)) return ['request_correction']
  return []
}
