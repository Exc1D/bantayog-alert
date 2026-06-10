/**
 * Staging Callable Client — REST helpers for the 2F callable lifecycle proof.
 *
 * Pure fetch-based helpers so unit tests need no network and no firebase-admin:
 * - exchangeCustomTokenForIdToken: custom token → ID token (Identity Toolkit).
 * - exchangeAppCheckDebugToken: registered debug token → App Check token.
 * - callStagingCallable: invoke a deployed v2 callable with auth + App Check.
 *
 * Token minting and Firestore assertions live with the proof driver
 * (2F-03), which composes these helpers with firebase-admin.
 */

const STAGING_PROJECT_ID = 'bantayog-alert-staging'
const PRODUCTION_PROJECT_ID = 'bantayog-alert'
const CALLABLE_REGION = 'asia-southeast1'

export class StagingCallableError extends Error {
  constructor(
    message: string,
    public readonly status: string,
  ) {
    super(message)
    this.name = 'StagingCallableError'
  }
}

export function buildCallableUrl(functionName: string): string {
  return `https://${CALLABLE_REGION}-${STAGING_PROJECT_ID}.cloudfunctions.net/${functionName}`
}

export function assertStagingCallableAllowed(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.FIRESTORE_EMULATOR_HOST?.trim()) {
    throw new Error(
      'staging-callable-client: FIRESTORE_EMULATOR_HOST is set. ' +
        'Use proof:mvp-loop for emulator testing.',
    )
  }

  const projectId =
    env.GCLOUD_PROJECT?.trim() ??
    env.FIREBASE_PROJECT_ID?.trim() ??
    env.GOOGLE_CLOUD_PROJECT?.trim()

  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `staging-callable-client: Refusing to target production project ${PRODUCTION_PROJECT_ID}.`,
    )
  }
}

async function readJsonBody(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(`${label} returned a non-JSON response (HTTP ${response.status}).`)
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (body == null || typeof body !== 'object' || !('error' in body)) {
    return undefined
  }
  const error = (body as { error: unknown }).error
  if (error == null || typeof error !== 'object' || !('message' in error)) {
    return undefined
  }
  const message = (error as { message: unknown }).message
  return typeof message === 'string' ? message : undefined
}

function extractCallableStatus(body: unknown): string | undefined {
  if (body == null || typeof body !== 'object' || !('error' in body)) {
    return undefined
  }
  const error = (body as { error: unknown }).error
  if (error == null || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }
  const status = (error as { status: unknown }).status
  return typeof status === 'string' ? status : undefined
}

export async function exchangeCustomTokenForIdToken(input: {
  apiKey: string
  customToken: string
  fetchImpl?: typeof fetch
}): Promise<string> {
  const { apiKey, customToken, fetchImpl = fetch } = input
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  const body = await readJsonBody(response, 'Identity Toolkit sign-in')

  if (!response.ok) {
    const message = extractErrorMessage(body) ?? `HTTP ${response.status}`
    throw new Error(`Identity Toolkit sign-in failed: ${message}`)
  }

  const idToken = (body as { idToken?: unknown }).idToken
  if (typeof idToken !== 'string' || idToken.length === 0) {
    throw new Error('Identity Toolkit sign-in succeeded but returned no idToken.')
  }
  return idToken
}

export async function exchangeAppCheckDebugToken(input: {
  apiKey: string
  appId: string
  debugToken: string
  fetchImpl?: typeof fetch
}): Promise<string> {
  const { apiKey, appId, debugToken, fetchImpl = fetch } = input
  const url =
    `https://firebaseappcheck.googleapis.com/v1/projects/${STAGING_PROJECT_ID}` +
    `/apps/${appId}:exchangeDebugToken?key=${apiKey}`

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debugToken }),
  })
  const body = await readJsonBody(response, 'App Check debug token exchange')

  if (!response.ok) {
    const message = extractErrorMessage(body) ?? `HTTP ${response.status}`
    throw new Error(`App Check debug token exchange failed: ${message}`)
  }

  const token = (body as { token?: unknown }).token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('App Check debug token exchange succeeded but returned no token.')
  }
  return token
}

export async function callStagingCallable(input: {
  functionName: string
  payload: unknown
  idToken: string
  appCheckToken: string
  fetchImpl?: typeof fetch
}): Promise<unknown> {
  const { functionName, payload, idToken, appCheckToken, fetchImpl = fetch } = input

  const response = await fetchImpl(buildCallableUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
    body: JSON.stringify({ data: payload }),
  })
  const body = await readJsonBody(response, functionName)

  const errorMessage = extractErrorMessage(body)
  if (errorMessage !== undefined || !response.ok) {
    const status = extractCallableStatus(body) ?? 'INTERNAL'
    const message = errorMessage ?? `HTTP ${response.status}`
    throw new StagingCallableError(`${functionName} failed: ${message}`, status)
  }

  return (body as { result?: unknown }).result
}
