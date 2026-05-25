import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('anonymousAuthCleanup')

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const PAGE_SIZE = 1000
const MAX_PAGES_PER_RUN = 5
const DELETE_USERS_QPS_DELAY_MS = 1100

export interface AnonymousAuthCleanupInput {
  auth: Pick<Auth, 'listUsers' | 'deleteUsers'>
  now?: () => number
  ttlMs?: number
  maxPages?: number
  sleep?: (ms: number) => Promise<void>
}

export interface AnonymousAuthCleanupResult {
  scanned: number
  eligible: number
  deleted: number
  failed: number
  pagesScanned: number
  hasMore: boolean
}

function parseAuthTimestamp(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasCustomClaims(user: UserRecord): boolean {
  const claims = user.customClaims
  return claims !== undefined && Object.keys(claims).length > 0
}

function isPlainAnonymousUser(user: UserRecord): boolean {
  return (
    user.providerData.length === 0 &&
    user.email === undefined &&
    user.phoneNumber === undefined &&
    !hasCustomClaims(user)
  )
}

function lastAuthActivityMs(user: UserRecord): number | null {
  return (
    parseAuthTimestamp(user.metadata.lastSignInTime) ??
    parseAuthTimestamp(user.metadata.creationTime)
  )
}

export async function anonymousAuthCleanupCore(
  input: AnonymousAuthCleanupInput,
): Promise<AnonymousAuthCleanupResult> {
  const now = input.now ?? (() => Date.now())
  const ttlMs = input.ttlMs ?? THIRTY_DAYS_MS
  const maxPages = input.maxPages ?? MAX_PAGES_PER_RUN
  const sleep =
    input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const cutoff = now() - ttlMs
  const result: AnonymousAuthCleanupResult = {
    scanned: 0,
    eligible: 0,
    deleted: 0,
    failed: 0,
    pagesScanned: 0,
    hasMore: false,
  }

  let pageToken: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const pageResult = await input.auth.listUsers(PAGE_SIZE, pageToken)
    result.pagesScanned++
    result.scanned += pageResult.users.length

    const uidsToDelete = pageResult.users
      .filter((user) => {
        if (!isPlainAnonymousUser(user)) return false
        const lastSeenAt = lastAuthActivityMs(user)
        return lastSeenAt !== null && lastSeenAt < cutoff
      })
      .map((user) => user.uid)

    if (uidsToDelete.length > 0) {
      result.eligible += uidsToDelete.length
      try {
        const deleteResult = await input.auth.deleteUsers(uidsToDelete)
        result.deleted += deleteResult.successCount
        result.failed += deleteResult.failureCount
        for (const error of deleteResult.errors) {
          const uid = uidsToDelete[error.index]
          log({
            severity: 'ERROR',
            code: 'ANONYMOUS_AUTH_DELETE_FAILED',
            message: `failed to delete stale anonymous auth user ${uid ?? 'unknown'}`,
            data: { uid, error: error.error.message },
          })
        }
      } catch (err: unknown) {
        result.failed += uidsToDelete.length
        log({
          severity: 'ERROR',
          code: 'ANONYMOUS_AUTH_DELETE_BATCH_FAILED',
          message: `failed to delete stale anonymous auth batch: ${err instanceof Error ? err.message : String(err)}`,
          data: { count: uidsToDelete.length },
        })
      }
      if (pageResult.pageToken && page + 1 < maxPages) {
        await sleep(DELETE_USERS_QPS_DELAY_MS)
      }
    }

    pageToken = pageResult.pageToken
    if (!pageToken) return result
  }

  result.hasMore = true
  return result
}

export const anonymousAuthCleanup = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'asia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const result = await anonymousAuthCleanupCore({ auth: getAuth() })
    log({
      severity: result.failed > 0 || result.hasMore ? 'WARNING' : 'INFO',
      code: 'ANONYMOUS_AUTH_CLEANUP',
      message: `anonymous auth cleanup scanned ${String(result.scanned)} users and deleted ${String(result.deleted)}`,
      data: result as unknown as Record<string, unknown>,
    })
  },
)
