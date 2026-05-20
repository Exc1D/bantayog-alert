import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupProofRun,
  getProofDatabaseURL,
  isAuthUserNotFound,
  preflightProofServices,
  type ProofEnvironment,
  type ProofLedger,
} from './reliability-spine'

const stagingEnv: ProofEnvironment = {
  target: 'staging',
  projectId: 'bantayog-alert-staging',
  citizenBaseUrl: 'https://bantayog-citizen-staging.web.app',
  adminBaseUrl: 'https://admin.example.test',
  responderBaseUrl: 'https://responder.example.test',
}

function withEnv(values: Record<string, string | undefined>) {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key])
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

describe('preflightProofServices', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fails staging preflight before browser work when required proof accounts are missing', async () => {
    const restore = withEnv({
      BANTAYOG_ADMIN_UID: undefined,
      BANTAYOG_RESPONDER_UID: 'responder-1',
      BANTAYOG_ADMIN_EMAIL: 'admin@example.test',
      BANTAYOG_ADMIN_PASSWORD: 'test123456',
      BANTAYOG_RESPONDER_EMAIL: 'responder@example.test',
      BANTAYOG_RESPONDER_PASSWORD: 'test123456',
      FIRESTORE_EMULATOR_HOST: undefined,
      FIREBASE_AUTH_EMULATOR_HOST: undefined,
      FIREBASE_DATABASE_EMULATOR_HOST: undefined,
    })

    await expect(
      preflightProofServices({
        env: stagingEnv,
        db: {} as never,
        auth: {} as never,
      }),
    ).rejects.toThrow(/BANTAYOG_ADMIN_UID/)
    restore()
  })
})

describe('getProofDatabaseURL', () => {
  it('builds the Admin SDK Realtime Database emulator URL for local proof runs', () => {
    expect(
      getProofDatabaseURL({
        target: 'local',
        projectId: 'bantayog-alert-staging',
        databaseHost: '127.0.0.1:9000',
      }),
    ).toBe('http://127.0.0.1:9000?ns=bantayog-alert-staging')
  })
})

describe('isAuthUserNotFound', () => {
  it('recognizes Firebase Admin emulator user-not-found errors by code', () => {
    expect(isAuthUserNotFound({ code: 'auth/user-not-found', message: 'missing' })).toBe(true)
  })
})

describe('cleanupProofRun', () => {
  it('continues deleting known artifacts when one delete rejects', async () => {
    const deleteReport = vi.fn().mockRejectedValue(new Error('delete denied'))
    const deleteOps = vi.fn().mockResolvedValue(undefined)
    const deleteLookup = vi.fn().mockResolvedValue(undefined)
    const collection = vi.fn((name: string) => ({
      doc: vi.fn((id: string) => ({
        delete:
          name === 'reports' && id === 'report-1'
            ? deleteReport
            : name === 'report_ops' && id === 'report-1'
              ? deleteOps
              : name === 'report_lookup' && id === 'ref-1'
                ? deleteLookup
                : vi.fn().mockResolvedValue(undefined),
      })),
    }))
    const ledger: ProofLedger = {
      testRunId: 'run-1',
      target: 'staging',
      municipalityId: 'daet',
      publicRef: 'ref-1',
      reportId: 'report-1',
      alertId: 'alert-1',
      dispatchId: 'dispatch-1',
    }

    await expect(cleanupProofRun({ db: { collection } as never }, ledger)).rejects.toThrow(
      /reports\/report-1/,
    )

    expect(deleteReport).toHaveBeenCalledTimes(1)
    expect(deleteOps).toHaveBeenCalledTimes(1)
    expect(deleteLookup).toHaveBeenCalledTimes(1)
  })
})
