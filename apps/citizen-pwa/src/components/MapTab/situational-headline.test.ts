import { describe, expect, it } from 'vitest'

import { buildSituationalHeadline } from './situational-headline.js'

describe('buildSituationalHeadline', () => {
  it('shows a calm headline when no alerts or incidents are active', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 0,
        incidentCount: 0,
        municipalityLabel: 'Daet',
      }),
    ).toBe('Daet is calm. No active alerts.')
  })

  it('prioritizes active alerts with a path to the Alerts tab', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 2,
        incidentCount: 0,
        municipalityLabel: 'Daet',
      }),
    ).toBe('2 active alerts for Daet. Tap Alerts to view.')
  })

  it('summarizes nearby incidents when there are no active alerts', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 0,
        incidentCount: 3,
        municipalityLabel: 'Daet',
      }),
    ).toBe('3 incidents reported nearby.')
  })
})
