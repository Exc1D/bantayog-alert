import type { PublicIncident } from '../components/MapTab/types.js'
import { isPublicIncidentData } from './public-incident-guard.js'

export interface PublicIncidentMediaCandidates {
  featuredMediaIds: string[]
  mediaRefs: string[]
}

function firstThreeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 3).filter((item): item is string => typeof item === 'string')
}

export function mapPublicIncidentData(
  id: string,
  raw: unknown,
  featuredMediaUrls?: string[],
): PublicIncident | null {
  if (!isPublicIncidentData(raw)) return null
  const incident: PublicIncident = {
    id,
    ...raw,
  }
  if (featuredMediaUrls && featuredMediaUrls.length > 0) {
    incident.featuredMediaUrls = featuredMediaUrls
  }
  return incident
}

export function getPublicIncidentMediaCandidates(raw: unknown): PublicIncidentMediaCandidates {
  if (!raw || typeof raw !== 'object') {
    return { featuredMediaIds: [], mediaRefs: [] }
  }
  const data = raw as Record<string, unknown>
  return {
    featuredMediaIds: firstThreeStrings(data.featuredMediaIds),
    mediaRefs: firstThreeStrings(data.mediaRefs),
  }
}

export function filterPublicIncidentsByMunicipality(
  incidents: PublicIncident[],
  municipality: string,
): PublicIncident[] {
  if (!municipality) return incidents
  return incidents.filter((incident) => incident.municipalityLabel === municipality)
}
