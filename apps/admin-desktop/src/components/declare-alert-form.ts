export const REQUIRES_EFFECTIVE_PERIOD = new Set([
  'scheduled_power_interruption',
  'class_suspension',
  'work_suspension',
  'transport_suspension',
  'curfew',
])

export const SHOWS_ROAD_NAME = new Set(['road_closure', 'bridge_closure'])

export type DeclareAlertValidationErrors = Partial<
  Record<
    'hazardType' | 'municipalities' | 'effectiveFrom' | 'effectiveUntil' | 'roadName' | 'message',
    string
  >
>

export interface DeclareAlertValidationInput {
  hazardType: string
  selectedMunicipalityIds: ReadonlySet<string>
  message: string
  effectiveFrom: string
  effectiveUntil: string
  roadName: string
}

export interface DeclareAlertPayloadInput extends DeclareAlertValidationInput {
  expectedResolutionAt: string
  selectedSectors: ReadonlySet<string>
  selectedBarangayIds: ReadonlySet<string>
  reportId: string | undefined
}

export interface DeclareAlertPayload {
  hazardType: string
  affectedMunicipalityIds: string[]
  message: string
  reportId?: string
  effectiveFrom?: number
  effectiveUntil?: number
  expectedResolutionAt?: number
  affectedSectors?: string[]
  affectedBarangayIds?: string[]
  roadName?: string
}

export function defaultSectorsForHazardType(hazardType: string): Set<string> {
  if (hazardType === 'class_suspension') {
    return new Set(['public_schools', 'private_schools'])
  }
  if (hazardType === 'work_suspension') {
    return new Set(['government_offices', 'private_business'])
  }
  return new Set()
}

function safeParseDateTime(value: string): number | null {
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : null
}

export function validateDeclareAlertForm(
  values: DeclareAlertValidationInput,
): DeclareAlertValidationErrors {
  const errors: DeclareAlertValidationErrors = {}
  if (!values.hazardType) errors.hazardType = 'Select an alert type'
  if (values.selectedMunicipalityIds.size === 0) {
    errors.municipalities = 'Select at least one municipality'
  }
  if (REQUIRES_EFFECTIVE_PERIOD.has(values.hazardType)) {
    if (!values.effectiveFrom) errors.effectiveFrom = 'Start time is required for this alert type'
    if (!values.effectiveUntil) errors.effectiveUntil = 'End time is required for this alert type'
  }
  if (values.effectiveFrom && values.effectiveUntil) {
    const fromMs = safeParseDateTime(values.effectiveFrom)
    const untilMs = safeParseDateTime(values.effectiveUntil)
    if (fromMs == null) {
      errors.effectiveFrom = 'Invalid start time'
    }
    if (untilMs == null) {
      errors.effectiveUntil = 'Invalid end time'
    }
    if (fromMs != null && untilMs != null && untilMs <= fromMs) {
      errors.effectiveUntil = 'End time must be after start time'
    }
  }
  if (SHOWS_ROAD_NAME.has(values.hazardType) && !values.roadName.trim()) {
    errors.roadName = 'Road name is required for this alert type'
  }
  if (!values.message.trim()) errors.message = 'Message is required'
  return errors
}

export function buildDeclareAlertPayload(values: DeclareAlertPayloadInput): DeclareAlertPayload {
  const payload: DeclareAlertPayload = {
    hazardType: values.hazardType,
    affectedMunicipalityIds: Array.from(values.selectedMunicipalityIds),
    message: values.message.trim(),
    ...(values.reportId ? { reportId: values.reportId } : {}),
  }

  if (values.effectiveFrom) {
    const ts = safeParseDateTime(values.effectiveFrom)
    if (ts != null) payload.effectiveFrom = ts
  }
  if (values.effectiveUntil) {
    const ts = safeParseDateTime(values.effectiveUntil)
    if (ts != null) payload.effectiveUntil = ts
  }
  if (values.expectedResolutionAt) {
    const ts = safeParseDateTime(values.expectedResolutionAt)
    if (ts != null) payload.expectedResolutionAt = ts
  }

  if (values.selectedSectors.size > 0) {
    payload.affectedSectors = Array.from(values.selectedSectors)
  }
  if (values.selectedBarangayIds.size > 0) {
    payload.affectedBarangayIds = Array.from(values.selectedBarangayIds)
  }
  if (values.roadName.trim()) {
    payload.roadName = values.roadName.trim()
  }

  return payload
}
