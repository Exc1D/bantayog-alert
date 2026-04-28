// e2e-tests/k6/lib/callable.js
import http from 'k6/http'
import { assertTokenFresh } from './firebase-auth.js'

/**
 * POST to a Firebase callable function.
 * URL: https://{region}-{projectId}.cloudfunctions.net/{functionName}
 * Returns the raw k6 response object.
 */
export function callFirebase(projectId, region, functionName, tokenData, data) {
  assertTokenFresh(tokenData)
  const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`
  return http.post(url, JSON.stringify({ data }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
  })
}

/** Returns true if the callable response is a 200 success */
export function isOk(res) {
  return res.status === 200
}

/**
 * Returns true if the callable response is CONFLICT (dispatch no longer pending).
 * HTTP 409 + error.status === 'ALREADY_EXISTS'
 */
export function isConflict(res) {
  if (res.status !== 409) return false
  try {
    return JSON.parse(res.body).error?.status === 'ALREADY_EXISTS'
  } catch {
    return false
  }
}
