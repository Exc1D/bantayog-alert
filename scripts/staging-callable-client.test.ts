import { describe, expect, it, vi } from 'vitest'
import {
  StagingCallableError,
  assertStagingCallableAllowed,
  buildCallableUrl,
  callStagingCallable,
  exchangeAppCheckDebugToken,
  exchangeCustomTokenForIdToken,
} from './staging-callable-client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token <')
    },
    text: async () => '<html>not found</html>',
  } as Response
}

describe('buildCallableUrl', () => {
  it('targets the staging project in asia-southeast1', () => {
    expect(buildCallableUrl('submitCitizenReport')).toBe(
      'https://asia-southeast1-bantayog-alert-staging.cloudfunctions.net/submitCitizenReport',
    )
  })
})

describe('assertStagingCallableAllowed', () => {
  it('refuses to run when the Firestore emulator host is set', () => {
    expect(() =>
      assertStagingCallableAllowed({ FIRESTORE_EMULATOR_HOST: 'localhost:8081' }),
    ).toThrow(/emulator/i)
  })

  it('refuses to run against the production project', () => {
    expect(() => assertStagingCallableAllowed({ GCLOUD_PROJECT: 'bantayog-alert' })).toThrow(
      /production/i,
    )
  })

  it('allows a clean staging environment', () => {
    expect(() =>
      assertStagingCallableAllowed({ GCLOUD_PROJECT: 'bantayog-alert-staging' }),
    ).not.toThrow()
  })
})

describe('exchangeCustomTokenForIdToken', () => {
  it('exchanges a custom token via the Identity Toolkit REST API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ idToken: 'id-token-1' }))

    const idToken = await exchangeCustomTokenForIdToken({
      apiKey: 'staging-key',
      customToken: 'custom-token-1',
      fetchImpl,
    })

    expect(idToken).toBe('id-token-1')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=staging-key',
    )
    expect(JSON.parse(String(init.body))).toEqual({
      token: 'custom-token-1',
      returnSecureToken: true,
    })
  })

  it('throws with the Identity Toolkit error message on failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'INVALID_CUSTOM_TOKEN' } }, 400))

    await expect(
      exchangeCustomTokenForIdToken({
        apiKey: 'staging-key',
        customToken: 'bad-token',
        fetchImpl,
      }),
    ).rejects.toThrow(/INVALID_CUSTOM_TOKEN/)
  })
})

describe('exchangeAppCheckDebugToken', () => {
  it('exchanges a registered debug token for an App Check token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ token: 'app-check-token-1' }))

    const token = await exchangeAppCheckDebugToken({
      apiKey: 'staging-key',
      appId: '1:123:web:abc',
      debugToken: 'debug-token-1',
      fetchImpl,
    })

    expect(token).toBe('app-check-token-1')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://firebaseappcheck.googleapis.com/v1/projects/bantayog-alert-staging/apps/1:123:web:abc:exchangeDebugToken?key=staging-key',
    )
    expect(JSON.parse(String(init.body))).toEqual({ debugToken: 'debug-token-1' })
  })

  it('throws when the debug token is rejected', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'App attestation failed.' } }, 403))

    await expect(
      exchangeAppCheckDebugToken({
        apiKey: 'staging-key',
        appId: '1:123:web:abc',
        debugToken: 'unregistered',
        fetchImpl,
      }),
    ).rejects.toThrow(/App attestation failed/)
  })
})

describe('callStagingCallable', () => {
  it('posts the callable envelope with auth and App Check headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ result: { reportId: 'r-1' } }))

    const result = await callStagingCallable({
      functionName: 'submitCitizenReport',
      payload: { reportType: 'fire' },
      idToken: 'id-token-1',
      appCheckToken: 'app-check-token-1',
      fetchImpl,
    })

    expect(result).toEqual({ reportId: 'r-1' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://asia-southeast1-bantayog-alert-staging.cloudfunctions.net/submitCitizenReport',
    )
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer id-token-1',
      'X-Firebase-AppCheck': 'app-check-token-1',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(init.body))).toEqual({ data: { reportType: 'fire' } })
  })

  it('throws a StagingCallableError carrying the stable status code', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { message: 'Report not found.', status: 'NOT_FOUND' } }, 404),
      )

    const call = callStagingCallable({
      functionName: 'verifyReport',
      payload: { reportId: 'missing' },
      idToken: 'id-token-1',
      appCheckToken: 'app-check-token-1',
      fetchImpl,
    })

    await expect(call).rejects.toBeInstanceOf(StagingCallableError)
    await expect(call).rejects.toMatchObject({ status: 'NOT_FOUND' })
  })

  it('throws with the HTTP status when the response is not callable JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse(404))

    await expect(
      callStagingCallable({
        functionName: 'doesNotExist',
        payload: {},
        idToken: 'id-token-1',
        appCheckToken: 'app-check-token-1',
        fetchImpl,
      }),
    ).rejects.toThrow(/HTTP 404/)
  })
})
