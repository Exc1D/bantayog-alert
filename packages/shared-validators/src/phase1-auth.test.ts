import { describe, expect, it } from 'vitest'
import {
  activeAccountSchema,
  alertSchema,
  claimRevocationSchema,
  minAppVersionSchema,
  setStaffClaimsInputSchema,
  suspendStaffAccountInputSchema,
} from './index.js'

describe('activeAccountSchema', () => {
  it('accepts an active municipal admin record', () => {
    expect(
      activeAccountSchema.parse({
        uid: 'admin-1',
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      }),
    ).toMatchObject({ uid: 'admin-1', municipalityId: 'daet' })
  })

  it('rejects unsupported account statuses', () => {
    expect(() =>
      activeAccountSchema.parse({
        uid: 'admin-1',
        role: 'municipal_admin',
        accountStatus: 'revoked',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      }),
    ).toThrow(/Invalid option/)
  })
})

describe('claimRevocationSchema', () => {
  it('requires a revocation timestamp and reason', () => {
    expect(
      claimRevocationSchema.parse({
        uid: 'admin-1',
        revokedAt: 1713350400000,
        reason: 'suspended',
      }),
    ).toMatchObject({ reason: 'suspended' })
  })
})

describe('setStaffClaimsInputSchema', () => {
  it('requires municipality scope for municipal admins', () => {
    expect(() =>
      setStaffClaimsInputSchema.parse({
        uid: 'admin-1',
        role: 'municipal_admin',
      }),
    ).toThrow(/municipalityId/)
  })
})

describe('suspendStaffAccountInputSchema', () => {
  it('accepts a suspension payload', () => {
    expect(
      suspendStaffAccountInputSchema.parse({
        uid: 'admin-1',
        reason: 'suspended',
      }),
    ).toMatchObject({ uid: 'admin-1' })
  })
})

describe('minAppVersionSchema', () => {
  it('parses the phase 1 config document', () => {
    expect(
      minAppVersionSchema.parse({
        citizen: '0.1.0',
        admin: '0.1.0',
        responder: '0.1.0',
        updatedAt: 1713350400000,
      }),
    ).toMatchObject({ citizen: '0.1.0' })
  })
})

describe('alertSchema', () => {
  it('parses a benign hello-world feed item', () => {
    expect(
      alertSchema.parse({
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: 1713350400000,
        publishedBy: 'phase-1-bootstrap',
      }),
    ).toMatchObject({ severity: 'info' })
  })
})
