import { describe, expect, it } from 'vitest'
import { CAMARINES_NORTE_MUNICIPALITIES } from '../packages/shared-validators/src/municipalities'
import { REPORTS, buildDispatchSeeds, buildReportOpsSeeds } from './seed-staging-incidents'

describe('staging incident seed companions', () => {
  it('uses municipality IDs from the shared canonical municipality list', () => {
    const validMunicipalityIds = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id))

    expect(REPORTS.map((report) => report.municipalityId)).toEqual(
      expect.arrayContaining(REPORTS.map((report) => expect.stringMatching(/^[a-z-]+$/))),
    )
    for (const report of REPORTS) {
      expect(validMunicipalityIds.has(report.municipalityId)).toBe(true)
    }
  })

  it('builds one report_ops companion for every seeded report', () => {
    const opsSeeds = buildReportOpsSeeds(REPORTS)

    expect(opsSeeds.map((seed) => seed.id)).toEqual(REPORTS.map((report) => report.id))
    for (const seed of opsSeeds) {
      const report = REPORTS.find((candidate) => candidate.id === seed.id)
      expect(report).toBeDefined()
      expect(seed.data).toMatchObject({
        reportId: seed.id,
        municipalityId: report?.municipalityId,
        status: report?.status,
        severity: report?.severity,
        reportType: report?.reportType,
      })
    }
  })

  it('builds an active dispatch row for the seeded BFP responder report', () => {
    expect(buildDispatchSeeds(REPORTS)).toContainEqual(
      expect.objectContaining({
        id: 'seed-report-002_bfp-responder-test-01',
        data: expect.objectContaining({
          reportId: 'seed-report-002',
          status: 'pending',
          municipalityId: 'daet',
          assignedTo: {
            uid: 'bfp-responder-test-01',
            agencyId: 'bfp-daet',
            municipalityId: 'daet',
          },
        }),
      }),
    )
  })
})
