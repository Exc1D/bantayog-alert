import { describe, it, beforeAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getTestEnv } from './setup'
import {
  citizenCtx,
  responderCtx,
  muniAdminCtx,
  agencyAdminCtx,
  superadminCtx,
  unauthCtx,
} from './helpers'

describe('cross-municipality leakage prevention', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      // Seed active_accounts for privileged checks
      await setDoc(doc(db, 'active_accounts', 'admin_daet'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
      await setDoc(doc(db, 'active_accounts', 'admin_labo'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })

      // Seed a report in Daet
      await setDoc(doc(db, 'report_private', 'rpt_1'), {
        municipalityId: 'daet',
        reporterUid: 'c1',
      })
      await setDoc(doc(db, 'report_ops', 'rpt_1'), {
        municipalityId: 'daet',
        status: 'new',
        severity: 'high',
        agencyIds: ['agency_bfp'],
        visibility: { scope: 'municipality', sharedWith: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        activeResponderCount: 0,
        requiresLocationFollowUp: false,
      })
      await setDoc(doc(db, 'report_contacts', 'rpt_1'), { municipalityId: 'daet' })
    })
  })

  it('Labo admin CANNOT read Daet report_private', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_labo', 'labo')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_private', 'rpt_1')))
  })

  it('Labo admin CANNOT read Daet report_ops', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_labo', 'labo')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_ops', 'rpt_1')))
  })

  it('Labo admin CANNOT read Daet report_contacts', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_labo', 'labo')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_contacts', 'rpt_1')))
  })

  it('Daet admin CAN read own report_private', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_daet', 'daet')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'report_private', 'rpt_1')))
  })
})

describe('cross-agency dispatch leakage prevention', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'active_accounts', 'responder_bfp'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
      await setDoc(doc(db, 'active_accounts', 'responder_pnp'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })

      // BFP dispatch
      await setDoc(doc(db, 'dispatches', 'dsp_1'), {
        responderId: 'responder_bfp',
        municipalityId: 'daet',
        agencyId: 'agency_bfp',
        status: 'accepted',
        reportId: 'rpt_1',
        dispatchedBy: 'admin_1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: new Date(),
        statusUpdatedAt: new Date(),
        acknowledgementDeadlineAt: new Date(),
        idempotencyKey: 'k1',
        schemaVersion: 1,
      })
    })
  })

  it('PNP responder CANNOT read BFP dispatch', async () => {
    const ctx = responderCtx(testEnv, 'responder_pnp', { agencyId: 'agency_pnp' })
    await assertFails(getDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1')))
  })

  it('BFP responder CAN read own dispatch', async () => {
    const ctx = responderCtx(testEnv, 'responder_bfp', { agencyId: 'agency_bfp' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1')))
  })

  it('citizen CANNOT read any dispatch', async () => {
    const ctx = citizenCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1')))
  })
})

describe('responder dispatch transition validation', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'active_accounts', 'responder_1'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
      await setDoc(doc(db, 'dispatches', 'dsp_1'), {
        responderId: 'responder_1',
        municipalityId: 'daet',
        agencyId: 'agency_bfp',
        status: 'accepted',
        reportId: 'rpt_1',
        dispatchedBy: 'admin_1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: new Date(),
        statusUpdatedAt: new Date(),
        acknowledgementDeadlineAt: new Date(),
        idempotencyKey: 'k1',
        schemaVersion: 1,
      })
    })
  })

  it('should allow accepted → acknowledged', async () => {
    const ctx = responderCtx(testEnv, 'responder_1')
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1'), {
        status: 'acknowledged',
        statusUpdatedAt: new Date(),
        acknowledgedAt: new Date(),
      }),
    )
  })

  it('should reject accepted → resolved (skipping steps)', async () => {
    const ctx = responderCtx(testEnv, 'responder_1')
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1'), {
        status: 'resolved',
        statusUpdatedAt: new Date(),
        resolvedAt: new Date(),
      }),
    )
  })

  it('should reject transition with forbidden fields', async () => {
    const ctx = responderCtx(testEnv, 'responder_1')
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1'), {
        status: 'acknowledged',
        statusUpdatedAt: new Date(),
        acknowledgedAt: new Date(),
        municipalityId: 'labo', // forbidden field change
      }),
    )
  })
})

describe('suspended account enforcement', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      // active_accounts says suspended
      await setDoc(doc(db, 'active_accounts', 'suspended_admin'), {
        accountStatus: 'suspended',
        lastUpdatedAt: new Date(),
      })
      await setDoc(doc(db, 'report_private', 'rpt_1'), {
        municipalityId: 'daet',
        reporterUid: 'c1',
      })
    })
  })

  it('suspended admin CANNOT read report_private (isActivePrivileged fails)', async () => {
    const ctx = muniAdminCtx(testEnv, 'suspended_admin', 'daet')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_private', 'rpt_1')))
  })
})
