import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'

export const ts = 1713350400000

export async function seedActiveAccount(
  env: RulesTestEnvironment,
  opts: {
    uid: string
    role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
    municipalityId?: string
    agencyId?: string
    permittedMunicipalityIds?: string[]
    accountStatus?: 'active' | 'suspended' | 'disabled'
  },
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'active_accounts', opts.uid), {
      uid: opts.uid,
      role: opts.role,
      accountStatus: opts.accountStatus ?? 'active',
      municipalityId: opts.municipalityId ?? null,
      agencyId: opts.agencyId ?? null,
      permittedMunicipalityIds: opts.permittedMunicipalityIds ?? [],
      mfaEnrolled: true,
      lastClaimIssuedAt: ts,
      updatedAt: ts,
    })
  })
}

export function staffClaims(opts: {
  role: 'municipal_admin' | 'agency_admin' | 'provincial_superadmin' | 'responder' | 'citizen'
  municipalityId?: string
  agencyId?: string
  permittedMunicipalityIds?: string[]
  accountStatus?: 'active' | 'suspended'
}): Record<string, unknown> {
  return {
    role: opts.role,
    accountStatus: opts.accountStatus ?? 'active',
    municipalityId: opts.municipalityId ?? null,
    agencyId: opts.agencyId ?? null,
    permittedMunicipalityIds: opts.permittedMunicipalityIds ?? [],
  }
}

export async function seedReport(
  env: RulesTestEnvironment,
  reportId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'reports', reportId), {
      municipalityId: 'daet',
      reporterRole: 'citizen',
      reportType: 'flood',
      severity: 'high',
      status: 'verified',
      mediaRefs: [],
      description: 'seeded',
      submittedAt: ts,
      retentionExempt: false,
      visibilityClass: 'internal',
      visibility: { scope: 'municipality', sharedWith: [] },
      source: 'web',
      hasPhotoAndGPS: false,
      schemaVersion: 1,
      ...overrides,
    })
    await setDoc(doc(db, 'report_ops', reportId), {
      municipalityId: 'daet',
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      updatedAt: ts,
      schemaVersion: 1,
      ...(overrides.opsOverrides as Record<string, unknown> | undefined),
    })
    await setDoc(doc(db, 'report_private', reportId), {
      municipalityId: 'daet',
      reporterUid: 'citizen-1',
      isPseudonymous: true,
      publicTrackingRef: 'ref-12345',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
}

export async function seedAgency(
  env: RulesTestEnvironment,
  agencyId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'agencies', agencyId), {
      municipalityId: 'daet',
      name: 'Test Agency',
      agencyType: 'bfp',
      contactNumber: '+1234567890',
      isActive: true,
      createdAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
  })
}

export async function seedUser(
  env: RulesTestEnvironment,
  userId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', userId), {
      uid: userId,
      municipalityId: 'daet',
      name: 'Test User',
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      isActive: true,
      createdAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
  })
}

export async function seedResponder(
  env: RulesTestEnvironment,
  responderId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'responders', responderId), {
      uid: responderId,
      municipalityId: 'daet',
      name: 'Test Responder',
      phoneNumber: '+1234567890',
      isActive: true,
      agencyId: null,
      currentStatus: 'available',
      lastLocationUpdate: ts,
      createdAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
  })
}

export async function seedDispatch(
  env: RulesTestEnvironment,
  dispatchId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'dispatches', dispatchId), {
      dispatchId,
      municipalityId: 'daet',
      reportId: 'report-1',
      agencyId: 'agency-1',
      priority: 'high',
      status: 'pending',
      assignedResponderUids: [],
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
  })
}

import type { Firestore } from 'firebase-admin/firestore'
import type { Database } from 'firebase-admin/database'

export async function seedResponderDoc(
  db: Firestore,
  o: {
    uid: string
    municipalityId: string
    agencyId: string
    isActive: boolean
    displayName?: string
  },
): Promise<void> {
  await db
    .collection('responders')
    .doc(o.uid)
    .set({
      uid: o.uid,
      municipalityId: o.municipalityId,
      agencyId: o.agencyId,
      displayName: o.displayName ?? `Responder ${o.uid}`,
      isActive: o.isActive,
      fcmTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1,
    })
}

export async function seedResponderShift(
  rtdb: Database,
  municipalityId: string,
  uid: string,
  isOnShift: boolean,
): Promise<void> {
  await rtdb
    .ref(`/responder_index/${municipalityId}/${uid}`)
    .set({ isOnShift, updatedAt: Date.now() })
}
