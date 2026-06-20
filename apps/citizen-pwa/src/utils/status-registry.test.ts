import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import {
  FRESHNESS_STATES,
  HAZARD_TYPES,
  OPERATIONAL_STAGES,
  getFreshnessPresentation,
  getHazardTypePresentation,
  getOperationalStagePresentation,
  getSeverityPresentation,
} from './status-registry.js'

describe('status registry', () => {
  it('provides an icon and label for every operational stage', () => {
    for (const stage of OPERATIONAL_STAGES) {
      const presentation = getOperationalStagePresentation(stage)

      expect(presentation.label).not.toBe('')
      expect(presentation.icon).toBeDefined()
    }
  })

  it('preserves the existing high severity presentation', () => {
    const presentation = getSeverityPresentation('high')

    expect(presentation.label).toBe('HIGH')
    expect(presentation.icon).toBe(AlertTriangle)
  })

  it('keeps critical severity out of the unknown fallback', () => {
    const presentation = getSeverityPresentation('critical')

    expect(presentation.label).toBe('CRITICAL')
    expect(presentation.icon).toBe(ShieldAlert)
    expect(presentation.fg).toBe('var(--color-severity-critical-fg)')
  })

  it('provides two-signal metadata for every known hazard and freshness state', () => {
    for (const hazard of HAZARD_TYPES) {
      expect(getHazardTypePresentation(hazard).label).not.toBe('')
      expect(getHazardTypePresentation(hazard).icon).toBeDefined()
    }
    for (const state of FRESHNESS_STATES) {
      expect(getFreshnessPresentation(state).label).not.toBe('')
      expect(getFreshnessPresentation(state).icon).toBeDefined()
    }
  })

  it('returns a defined fallback for unknown values', () => {
    expect(() => getSeverityPresentation('unexpected')).not.toThrow()
    expect(getSeverityPresentation('unexpected').label).toBe('INFO')
    expect(getOperationalStagePresentation('unexpected').label).toBe('Status unavailable')
  })
})
