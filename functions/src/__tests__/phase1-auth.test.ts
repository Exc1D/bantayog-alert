import { describe, expect, it } from 'vitest'
import {
  buildActiveAccountDoc,
  buildClaimRevocationDoc,
  buildStaffClaims,
} from '../auth/custom-claims.js'
import { buildPhase1SeedDocs } from '../bootstrap/phase1-seed.js'

describe('buildStaffClaims', () => {
  it('builds municipal admin claims with scoped municipality access', () => {
    expect(
      buildStaffClaims({
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: false,
      }),
    ).toMatchObject({
      role: 'municipal_admin',
      municipalityId: 'daet',
      permittedMunicipalityIds: ['daet'],
      accountStatus: 'active',
    })
  })
})

describe('buildActiveAccountDoc', () => {
  it('keeps the active-account document aligned with the claims payload', () => {
    const claims = buildStaffClaims({
      uid: 'responder-1',
      role: 'responder',
      agencyId: 'bfp-daet',
      permittedMunicipalityIds: ['daet'],
      mfaEnrolled: false,
    })

    expect(buildActiveAccountDoc('responder-1', claims, 1713350400000)).toMatchObject({
      uid: 'responder-1',
      agencyId: 'bfp-daet',
      accountStatus: 'active',
    })
  })
})

describe('buildClaimRevocationDoc', () => {
  it('creates a revocation payload for suspended accounts', () => {
    expect(buildClaimRevocationDoc('admin-1', 1713350400000, 'suspended')).toEqual({
      uid: 'admin-1',
      revokedAt: 1713350400000,
      reason: 'suspended',
    })
  })
})

describe('buildPhase1SeedDocs', () => {
  it('returns min app version config and one hello-world alert', () => {
    const seed = buildPhase1SeedDocs(1713350400000)

    expect(seed.systemConfig.min_app_version).toMatchObject({
      citizen: '0.1.0',
      admin: '0.1.0',
      responder: '0.1.0',
    })
    expect(seed.alerts).toHaveLength(1)
  })
})
