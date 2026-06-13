export type ReportReadinessLevel = 'good' | 'needs-attention'

interface ReportReadinessInput {
  reportType: string
  description: string
  peopleInjured: boolean
  peopleTrapped: boolean
  locationMethod: 'gps' | 'manual'
  location: { lat: number; lng: number }
  photoAttached: boolean
  municipalityLabel?: string
  barangayId?: string
  nearestLandmark?: string
}

interface ReportReadiness {
  level: ReportReadinessLevel
  lines: string[]
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function hasUsableGpsLocation(location: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    !(location.lat === 0 && location.lng === 0)
  )
}

export function buildReportReadiness(input: ReportReadinessInput): ReportReadiness {
  const hasIncidentType = input.reportType.trim().length > 0
  const hasDescription = input.description.trim().length > 0
  const hasManualLocation =
    hasText(input.municipalityLabel) || hasText(input.barangayId) || hasText(input.nearestLandmark)
  const hasLocation =
    hasManualLocation || (input.locationMethod === 'gps' && hasUsableGpsLocation(input.location))
  const lines: string[] = []

  if (!hasLocation) {
    lines.push(
      'Without location, responders may not know where to verify the incident. Add location or describe the nearest landmark.',
    )
  } else if (hasIncidentType && !hasDescription) {
    lines.push(
      'Your incident type and location are included. Adding a short description may help responders verify faster.',
    )
  } else if (hasIncidentType) {
    lines.push('Your incident type, location, and description are included.')
  } else {
    lines.push('Add an incident type so responders know what kind of help may be needed.')
  }

  if (!input.photoAttached) {
    lines.push('Add a photo only if it is safe to do so.')
  }

  if (input.peopleInjured || input.peopleTrapped) {
    lines.push('You marked that people may need urgent help. Responders will see that context.')
  }

  return {
    level: hasLocation && hasIncidentType ? 'good' : 'needs-attention',
    lines,
  }
}
