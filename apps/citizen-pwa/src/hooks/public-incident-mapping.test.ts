import { describe, expect, it } from 'vitest'

import {
  filterPublicIncidentsByMunicipality,
  getPublicIncidentMediaCandidates,
  mapPublicIncidentData,
} from './public-incident-mapping.js'
import type { PublicIncident } from '../components/MapTab/types.js'

const validIncidentData = {
  reportType: 'flood',
  severity: 'high',
  status: 'verified',
  barangayId: 'barangay-1',
  municipalityLabel: 'Daet',
  publicLocation: { lat: 14.112, lng: 122.956 },
  submittedAt: 1765000000000,
} satisfies Omit<PublicIncident, 'id'>

describe('mapPublicIncidentData', () => {
  it('maps valid raw data to a public incident', () => {
    expect(mapPublicIncidentData('report-1', validIncidentData)).toEqual({
      id: 'report-1',
      ...validIncidentData,
    })
  })

  it('returns null for malformed raw data', () => {
    expect(
      mapPublicIncidentData('report-1', { ...validIncidentData, status: 'unknown' }),
    ).toBeNull()
  })

  it('attaches featured media urls only when urls are present', () => {
    expect(mapPublicIncidentData('report-1', validIncidentData, ['gs://media-1'])).toMatchObject({
      id: 'report-1',
      featuredMediaUrls: ['gs://media-1'],
    })
    expect(mapPublicIncidentData('report-1', validIncidentData, [])).not.toHaveProperty(
      'featuredMediaUrls',
    )
  })
})

describe('getPublicIncidentMediaCandidates', () => {
  it('returns first three string featured ids and legacy refs', () => {
    expect(
      getPublicIncidentMediaCandidates({
        ...validIncidentData,
        featuredMediaIds: ['featured-1', 12, 'featured-2', 'featured-3', 'featured-4'],
        mediaRefs: ['legacy-1', false, 'legacy-2'],
      }),
    ).toEqual({
      featuredMediaIds: ['featured-1', 'featured-2'],
      mediaRefs: ['legacy-1', 'legacy-2'],
    })
  })

  it('returns empty candidate lists for non-object data', () => {
    expect(getPublicIncidentMediaCandidates(null)).toEqual({
      featuredMediaIds: [],
      mediaRefs: [],
    })
  })
})

describe('filterPublicIncidentsByMunicipality', () => {
  const incidents: PublicIncident[] = [
    { id: 'first', ...validIncidentData, municipalityLabel: 'Daet' },
    { id: 'second', ...validIncidentData, municipalityLabel: 'Basud' },
    { id: 'third', ...validIncidentData, municipalityLabel: 'Daet' },
  ]

  it('returns all incidents in order when no municipality is selected', () => {
    expect(
      filterPublicIncidentsByMunicipality(incidents, '').map((incident) => incident.id),
    ).toEqual(['first', 'second', 'third'])
  })

  it('filters by municipality while preserving result order', () => {
    expect(
      filterPublicIncidentsByMunicipality(incidents, 'Daet').map((incident) => incident.id),
    ).toEqual(['first', 'third'])
  })
})
