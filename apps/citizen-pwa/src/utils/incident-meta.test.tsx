import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { incidentIcon, incidentLabel, INCIDENT_TYPES } from './incident-meta'

describe('incident-meta', () => {
  it('incidentIcon returns non-null for all known types', () => {
    for (const type of INCIDENT_TYPES) {
      const icon = incidentIcon(type)
      expect(icon).not.toBeNull()
      expect(icon).toBeDefined()
    }
  })

  it('incidentIcon returns fallback for unknown type', () => {
    const icon = incidentIcon('unknown_type')
    expect(icon).toBeDefined()
  })

  it('incidentLabel returns non-empty string for all known types', () => {
    for (const type of INCIDENT_TYPES) {
      const label = incidentLabel(type)
      expect(label).toBeTruthy()
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('incidentLabel returns formatted fallback for unknown type', () => {
    expect(incidentLabel('some_new_type')).toBe('some new type')
  })

  it('incidentLabel returns correct labels for key types', () => {
    expect(incidentLabel('fire')).toBe('Fire')
    expect(incidentLabel('flood')).toBe('Flood')
    expect(incidentLabel('power_outage')).toBe('Power Outage')
    expect(incidentLabel('storm_surge')).toBe('Storm Surge')
  })
})
