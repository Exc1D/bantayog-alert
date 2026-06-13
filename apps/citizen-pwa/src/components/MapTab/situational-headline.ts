interface SituationalHeadlineInput {
  alertCount: number
  incidentCount: number
  municipalityLabel?: string
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildSituationalHeadline({
  alertCount,
  incidentCount,
  municipalityLabel,
}: SituationalHeadlineInput): string {
  const trimmedMunicipality = municipalityLabel?.trim()
  const place =
    trimmedMunicipality !== undefined && trimmedMunicipality.length > 0
      ? trimmedMunicipality
      : 'This area'

  if (alertCount > 0) {
    return `${String(alertCount)} active ${pluralize(alertCount, 'alert', 'alerts')}. Tap Alerts to view.`
  }

  if (incidentCount > 0) {
    return `${String(incidentCount)} ${pluralize(incidentCount, 'incident', 'incidents')} reported nearby.`
  }

  return `${place} is calm. No active alerts.`
}
