import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { CustomClaims } from '@bantayog/shared-types'

/** Create an authenticated context with custom claims */
export function authAs(testEnv: RulesTestEnvironment, uid: string, claims: Partial<CustomClaims>) {
  return testEnv.authenticatedContext(uid, {
    accountStatus: 'active',
    ...claims,
  })
}

/** Create a citizen context */
export function citizenCtx(testEnv: RulesTestEnvironment, uid = 'citizen_1') {
  return authAs(testEnv, uid, { role: 'citizen' })
}

/** Create a responder context */
export function responderCtx(
  testEnv: RulesTestEnvironment,
  uid = 'responder_1',
  opts: { agencyId?: string; municipalityId?: string } = {},
) {
  return authAs(testEnv, uid, {
    role: 'responder',
    agencyId: opts.agencyId ?? 'agency_bfp',
    municipalityId: opts.municipalityId ?? 'daet',
    mfaVerified: true,
  })
}

/** Create a municipal admin context */
export function muniAdminCtx(
  testEnv: RulesTestEnvironment,
  uid = 'admin_daet',
  municipalityId = 'daet',
) {
  return authAs(testEnv, uid, {
    role: 'municipal_admin',
    municipalityId,
    mfaVerified: true,
  })
}

/** Create an agency admin context */
export function agencyAdminCtx(
  testEnv: RulesTestEnvironment,
  uid = 'agency_admin_bfp',
  agencyId = 'agency_bfp',
) {
  return authAs(testEnv, uid, {
    role: 'agency_admin',
    agencyId,
    mfaVerified: true,
  })
}

/** Create a superadmin context */
export function superadminCtx(testEnv: RulesTestEnvironment, uid = 'superadmin_1') {
  return authAs(testEnv, uid, {
    role: 'provincial_superadmin',
    permittedMunicipalityIds: [
      'basud',
      'capalonga',
      'daet',
      'jose_panganiban',
      'labo',
      'mercedes',
      'paracale',
      'san_lorenzo_ruiz',
      'san_vicente',
      'santa_elena',
      'talisay',
      'vinzons',
    ],
    mfaVerified: true,
  })
}

/** Unauthenticated context */
export function unauthCtx(testEnv: RulesTestEnvironment) {
  return testEnv.unauthenticatedContext()
}
