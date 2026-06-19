import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'

const DEFAULT_LOCATION = { lat: 0, lng: 0 }

export type LocationConfidence = 'exact' | 'approximate' | 'manual'
export type Step2LocationMethod = 'gps' | 'manual' | null

interface LocationPoint {
  lat: number
  lng: number
}

export interface Step2WhoWhereInput {
  location: LocationPoint | null
  locationMethod: Step2LocationMethod
  selectedMunicipalityId: string
  selectedBarangayId: string | undefined
  nearestLandmark: string
  reporterName: string
  reporterMsisdn: string
  locationConfidence: LocationConfidence | undefined
}

export interface Step2WhoWhereNextData {
  location: LocationPoint
  reporterName: string
  reporterMsisdn: string
  locationMethod: 'gps' | 'manual'
  locationConfidence: LocationConfidence
  municipalityId?: string
  municipalityLabel?: string
  barangayId?: string
  nearestLandmark?: string
}

export interface Step2WhoWhereErrors {
  municipality?: string
  reporterName?: string
  reporterMsisdn?: string
}

export type Step2WhoWherePolicyResult =
  | { status: 'error'; errors: Step2WhoWhereErrors }
  | { status: 'ok'; next: Step2WhoWhereNextData }

export function validateStep2WhoWhere(input: Step2WhoWhereInput): Step2WhoWherePolicyResult {
  if (input.locationMethod === 'manual' && !input.selectedMunicipalityId) {
    return { status: 'error', errors: { municipality: 'Please select a municipality.' } }
  }
  if (!input.reporterName.trim()) {
    return { status: 'error', errors: { reporterName: 'Please enter your name.' } }
  }
  if (!input.reporterMsisdn.trim()) {
    return { status: 'error', errors: { reporterMsisdn: 'Please enter your phone number.' } }
  }

  return { status: 'ok', next: buildNextData(input) }
}

function buildNextData(input: Step2WhoWhereInput): Step2WhoWhereNextData {
  const manualLocation = buildManualLocation(input)
  const locationMethod = input.locationMethod ?? 'manual'
  return {
    location: manualLocation.location,
    reporterName: input.reporterName,
    reporterMsisdn: input.reporterMsisdn,
    locationMethod,
    locationConfidence: input.locationConfidence ?? 'manual',
    ...manualLocation.details,
  }
}

function buildManualLocation(input: Step2WhoWhereInput): {
  location: LocationPoint
  details: Partial<Step2WhoWhereNextData>
} {
  if (input.locationMethod !== 'manual' || !input.selectedMunicipalityId) {
    return { location: input.location ?? DEFAULT_LOCATION, details: {} }
  }

  const municipality = CAMARINES_NORTE_MUNICIPALITIES.find(
    (m) => m.id === input.selectedMunicipalityId,
  )
  return {
    location: resolveManualLocation(input.location, municipality?.centroid),
    details: buildManualDetails(input, municipality?.label),
  }
}

function resolveManualLocation(
  fallback: Step2WhoWhereInput['location'],
  centroid: LocationPoint | null | undefined,
): LocationPoint {
  return centroid ?? fallback ?? DEFAULT_LOCATION
}

function buildManualDetails(
  input: Step2WhoWhereInput,
  municipalityLabel: string | undefined,
): Partial<Step2WhoWhereNextData> {
  const details: Partial<Step2WhoWhereNextData> = {
    municipalityId: input.selectedMunicipalityId,
  }
  if (municipalityLabel) details.municipalityLabel = municipalityLabel
  if (input.selectedBarangayId) details.barangayId = input.selectedBarangayId
  if (input.nearestLandmark) details.nearestLandmark = input.nearestLandmark
  return details
}
