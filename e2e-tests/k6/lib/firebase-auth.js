// e2e-tests/k6/lib/firebase-auth.js
import http from 'k6/http'

const TOKEN_MAX_AGE_MS = 50 * 60 * 1000 // 50-min safety margin; tokens last 1 hour

/**
 * Signs in with email/password via REST identitytoolkit API.
 * Returns { token: string, uid: string, fetchedAt: number }
 */
export function getIdToken(apiKey, email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
  const res = http.post(url, JSON.stringify({ email, password, returnSecureToken: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status !== 200) {
    throw new Error(`Firebase auth failed (${res.status}): ${res.body}`)
  }
  const body = JSON.parse(res.body)
  return { token: body.idToken, uid: body.localId, fetchedAt: Date.now() }
}

/**
 * Signs in anonymously via REST identitytoolkit API.
 * Returns { token: string, uid: string, fetchedAt: number }
 */
export function getAnonymousToken(apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`
  const res = http.post(url, JSON.stringify({ returnSecureToken: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status !== 200) {
    throw new Error(`Anonymous auth failed (${res.status}): ${res.body}`)
  }
  const body = JSON.parse(res.body)
  return { token: body.idToken, uid: body.localId, fetchedAt: Date.now() }
}

/**
 * Throws a descriptive error if the token was fetched more than 50 minutes ago.
 * Do not chain scenarios back-to-back for longer than 50 minutes without re-fetching tokens.
 */
export function assertTokenFresh(tokenData) {
  if (Date.now() - tokenData.fetchedAt > TOKEN_MAX_AGE_MS) {
    throw new Error(
      'ID token is stale — re-run the scenario. ' +
        'Do not chain scenarios for more than 50 min after initial token fetch.',
    )
  }
}
