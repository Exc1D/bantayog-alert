// e2e-tests/k6/lib/firestore-rest.js
import http from 'k6/http'
import { assertTokenFresh } from './firebase-auth.js'

/**
 * Reads a Firestore document via REST API.
 * Returns null if document does not exist.
 * Returns the raw `fields` object if found.
 */
export function readDocument(projectId, collection, docId, tokenData) {
  assertTokenFresh(tokenData)
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/${collection}/${docId}`
  const res = http.get(url, { headers: { Authorization: `Bearer ${tokenData.token}` } })
  if (res.status === 404) return null
  if (res.status !== 200) throw new Error(`Firestore read failed (${res.status}): ${res.body}`)
  return JSON.parse(res.body).fields ?? null
}

/**
 * Writes a new document to a Firestore collection via REST API (POST = auto-generated ID).
 * `fields` must use Firestore REST typed-value format.
 * Returns the created document resource name (includes the generated ID).
 */
export function createDocument(projectId, collection, fields, tokenData) {
  assertTokenFresh(tokenData)
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/${collection}`
  const res = http.post(url, JSON.stringify({ fields }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
  })
  if (res.status !== 200) throw new Error(`Firestore write failed (${res.status}): ${res.body}`)
  return JSON.parse(res.body).name // e.g. "projects/.../documents/report_inbox/abc123"
}

/** Unwraps a single Firestore REST typed-value field */
export function extractValue(field) {
  if (!field) return undefined
  return (
    field.integerValue ??
    field.doubleValue ??
    field.stringValue ??
    field.booleanValue ??
    field.timestampValue ??
    null
  )
}
