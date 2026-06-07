import { describe, expect, it } from 'vitest'
import { deriveReportSeverity } from './report-severity.js'

describe('deriveReportSeverity', () => {
  it('marks trapped people as high severity', () => {
    expect(
      deriveReportSeverity({
        reportType: 'other',
        peopleInjured: false,
        peopleTrapped: true,
      }),
    ).toBe('high')
  })

  it('marks injury in high-risk report types as high severity', () => {
    for (const reportType of ['medical', 'accident', 'fire', 'landslide', 'flood', 'structural']) {
      expect(
        deriveReportSeverity({
          reportType,
          peopleInjured: true,
          peopleTrapped: false,
        }),
      ).toBe('high')
    }
  })

  it('marks injury in lower-risk report types as medium severity', () => {
    expect(
      deriveReportSeverity({
        reportType: 'security',
        peopleInjured: true,
        peopleTrapped: false,
      }),
    ).toBe('medium')
  })

  it('marks high-risk incident types as medium without injury or trapped signals', () => {
    for (const reportType of [
      'flood',
      'fire',
      'landslide',
      'storm_surge',
      'structural',
      'accident',
    ]) {
      expect(
        deriveReportSeverity({
          reportType,
          peopleInjured: false,
          peopleTrapped: false,
        }),
      ).toBe('medium')
    }
  })

  it('keeps lower-risk reports low without injury or trapped signals', () => {
    expect(
      deriveReportSeverity({
        reportType: 'other',
        peopleInjured: false,
        peopleTrapped: false,
      }),
    ).toBe('low')
  })
})
