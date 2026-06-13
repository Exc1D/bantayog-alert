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

  it('defaults to this area when the municipality label is missing or empty', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 0,
        incidentCount: 0,
      }),
    ).toBe('This area is calm. No active alerts.')
    expect(
      buildSituationalHeadline({
        alertCount: 0,
        incidentCount: 0,
        municipalityLabel: ' ',
      }),
    ).toBe('This area is calm. No active alerts.')
  })

  it('uses singular alert and incident copy at count one', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 1,
        incidentCount: 0,
        municipalityLabel: 'Daet',
      }),
    ).toBe('1 active alert. Tap Alerts to view.')
    expect(
      buildSituationalHeadline({
        alertCount: 0,
        incidentCount: 1,
        municipalityLabel: 'Daet',
      }),
    ).toBe('1 incident reported nearby.')
  })

  it('uses plural alert and incident copy above count one', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 2,
        incidentCount: 0,
        municipalityLabel: 'Daet',
      }),
    ).toBe('2 active alerts. Tap Alerts to view.')
    expect(
      buildSituationalHeadline({
        alertCount: 0,
        incidentCount: 3,
        municipalityLabel: 'Daet',
      }),
    ).toBe('3 incidents reported nearby.')
  })

  it('prioritizes active alerts with a path to the Alerts tab', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 2,
        incidentCount: 4,
        municipalityLabel: 'Daet',
      }),
    ).toBe('2 active alerts. Tap Alerts to view.')
  })

  it('keeps active alert copy global instead of municipality-scoped', () => {
    expect(
      buildSituationalHeadline({
        alertCount: 2,
        incidentCount: 0,
        municipalityLabel: 'Daet',
      }),
    ).toBe('2 active alerts. Tap Alerts to view.')
  })
})
