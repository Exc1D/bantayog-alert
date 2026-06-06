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
    if (new Date(values.effectiveUntil).getTime() <= new Date(values.effectiveFrom).getTime()) {
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
  return {
    hazardType: values.hazardType,
    affectedMunicipalityIds: Array.from(values.selectedMunicipalityIds),
    message: values.message.trim(),
    ...(values.reportId ? { reportId: values.reportId } : {}),
    ...(values.effectiveFrom ? { effectiveFrom: new Date(values.effectiveFrom).getTime() } : {}),
    ...(values.effectiveUntil ? { effectiveUntil: new Date(values.effectiveUntil).getTime() } : {}),
    ...(values.expectedResolutionAt
      ? { expectedResolutionAt: new Date(values.expectedResolutionAt).getTime() }
      : {}),
    ...(values.selectedSectors.size > 0
      ? { affectedSectors: Array.from(values.selectedSectors) }
      : {}),
    ...(values.selectedBarangayIds.size > 0
      ? { affectedBarangayIds: Array.from(values.selectedBarangayIds) }
      : {}),
    ...(values.roadName.trim() ? { roadName: values.roadName.trim() } : {}),
  }
}
