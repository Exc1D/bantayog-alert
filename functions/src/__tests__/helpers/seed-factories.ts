import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import type { ReportStatus } from '@bantayog/shared-types'

export const ts = 1713350400000

/**
 * Seeds an active_accounts document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
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

/**
 * Seeds reports + report_ops + report_private using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
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

/**
 * Seeds an agencies document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
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

/**
 * Seeds a users document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
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

/**
 * Seeds a responders document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
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

/**
 * Seeds a dispatches document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedDispatchRT(
  env: RulesTestEnvironment,
  dispatchId: string,
  overrides: Partial<
    Record<string, unknown> & {
      assignedTo?: { uid?: string; agencyId?: string; municipalityId?: string }
    }
  > = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // Extract assignedTo separately so we can merge with defaults instead of overwriting
    const { assignedTo: assignedToOverride, ...restOverrides } = overrides
    const mergedAssignedTo = {
      uid: assignedToOverride?.uid ?? '',
      agencyId: assignedToOverride?.agencyId ?? 'agency-1',
      municipalityId: assignedToOverride?.municipalityId ?? 'daet',
    }
    await setDoc(doc(db, 'dispatches', dispatchId), {
      ...restOverrides,
      dispatchId,
      municipalityId: 'daet',
      reportId: 'report-1',
      agencyId: 'agency-1',
      priority: 'high',
      status: 'pending',
      assignedTo: mergedAssignedTo,
      assignedResponderUids: [],
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
    })
  })
}

import type { Firestore } from 'firebase-admin/firestore'
import type { Database } from 'firebase-admin/database'

interface SeedVerifiedReportOptions {
  reportId?: string
  municipalityId?: string
  municipalityLabel?: string
  reporterUid?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  reporterContact?: {
    phone: string
    smsConsent: true
    locale?: 'tl' | 'en'
  }
}

/**
 * Seeds a report at a specific lifecycle status using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 * For mid-lifecycle states (new, awaiting_verify, verified) that bypass processInboxItem.
 */
export async function seedReportAtStatus(
  db: Firestore,
  status: ReportStatus,
  o: SeedVerifiedReportOptions = {},
): Promise<{ reportId: string }> {
  const reportId = o.reportId ?? db.collection('reports').doc().id
  const municipalityId = o.municipalityId ?? 'daet'
  const municipalityLabel = o.municipalityLabel ?? 'Daet'
  const now = Timestamp.now()

  await db
    .collection('reports')
    .doc(reportId)
    .set({
      reportId,
      status,
      municipalityId,
      municipalityLabel,
      source: 'citizen_pwa',
      severityDerived: o.severity ?? 'medium',
      correlationId: crypto.randomUUID(),
      createdAt: now,
      lastStatusAt: now,
      lastStatusBy: 'system:seed',
      schemaVersion: 1,
    })

  await db
    .collection('report_private')
    .doc(reportId)
    .set({
      reportId,
      reporterUid: o.reporterUid ?? 'reporter-1',
      rawDescription: 'Seed description',
      coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
      schemaVersion: 1,
    })

  await db.collection('report_ops').doc(reportId).set({
    reportId,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })

  if (o.reporterContact) {
    await db
      .collection('report_sms_consent')
      .doc(reportId)
      .set({
        reportId,
        phone: o.reporterContact.phone,
        locale: o.reporterContact.locale ?? 'tl',
        smsConsent: true,
        createdAt: now.toMillis(),
        schemaVersion: 1,
      })
  }

  return { reportId }
}

/**
 * Seeds a responders document using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 */
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

/**
 * Seeds a responder shift index using Firebase Realtime Database admin SDK directly.
 * Use in Cloud Functions context — not for RulesTestEnvironment RTDB context.
 */
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

/**
 * Seeds a dispatch document using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 */
export async function seedDispatch(
  db: Firestore,
  o: {
    dispatchId?: string
    reportId: string
    responderUid: string
    agencyId?: string
    municipalityId?: string
    status?:
      | 'pending'
      | 'accepted'
      | 'acknowledged'
      | 'en_route'
      | 'on_scene'
      | 'resolved'
      | 'declined'
      | 'timed_out'
      | 'superseded'
      | 'cancelled'
  },
): Promise<{ dispatchId: string }> {
  const dispatchId = o.dispatchId ?? db.collection('dispatches').doc().id
  const now = Timestamp.now()
  await db
    .collection('dispatches')
    .doc(dispatchId)
    .set({
      dispatchId,
      reportId: o.reportId,
      status: o.status ?? 'pending',
      assignedTo: {
        uid: o.responderUid,
        agencyId: o.agencyId ?? 'bfp-daet',
        municipalityId: o.municipalityId ?? 'daet',
      },
      dispatchedAt: now,
      lastStatusAt: now,
      acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
      correlationId: crypto.randomUUID(),
      schemaVersion: 1,
    })
  return { dispatchId }
}
