import { describe, expect, it } from 'vitest'
import {
  ALLOWED_MUNICIPALITY_IDS,
  BARANGAYS_BY_MUNICIPALITY,
  HAZARD_TYPE_LABELS,
  formatShortList,
} from './declare-alert-options'

describe('declare alert options', () => {
  it('summarizes long selected scopes without expanding every municipality', () => {
    expect(formatShortList(['Daet', 'Basud', 'Mercedes', 'Talisay'])).toBe(
      'Daet, Basud, Mercedes +1 more',
    )
  })

  it('keeps known municipality and hazard lookup data available to the modal', () => {
    expect(ALLOWED_MUNICIPALITY_IDS.has('daet')).toBe(true)
    expect(BARANGAYS_BY_MUNICIPALITY.daet?.length).toBeGreaterThan(0)
    expect(HAZARD_TYPE_LABELS.flood_advisory).toBe('Flood Advisory / Warning')
  })
})
