/**
 * Dispatch state machine — spec §5.4.
 *
 * Only responder-direct transitions are enforced at the Firestore rules layer.
 * Server-authoritative transitions (e.g. incident closure cascading to dispatch
 * resolution, or timeout → timed_out) live in Cloud Functions callables where
 * the full business logic is available.
 */

import type { DispatchStatus } from '../dispatches.js'

// Spec §5.4 — dispatch lifecycle states (Phase 3c: en_route + on_scene)
export const DISPATCH_STATES = [
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
] as const

/**
 * Valid dispatch state transitions.
 *
 * Responder progression: pending → accepted → acknowledged → en_route → on_scene → resolved
 * Admin actions: cancel from mid-lifecycle states, supersede by dispatching another responder
 * Terminal states: resolved, declined, timed_out, cancelled, superseded
 */
export const DISPATCH_TRANSITIONS: readonly [DispatchStatus, DispatchStatus][] = [
  // Responder progression flow
  ['pending', 'accepted'],
  ['accepted', 'acknowledged'],
  ['acknowledged', 'en_route'],
  ['en_route', 'on_scene'],
  ['on_scene', 'resolved'],

  // Admin can decline pending dispatches
  ['pending', 'declined'],

  // Admin can cancel from any mid-lifecycle state
  ['pending', 'cancelled'],
  ['pending', 'superseded'],
  ['accepted', 'cancelled'],
  ['accepted', 'superseded'],
  ['acknowledged', 'cancelled'],
  ['acknowledged', 'superseded'],
  ['en_route', 'cancelled'],
  ['en_route', 'superseded'],
  ['on_scene', 'cancelled'],
  ['on_scene', 'superseded'],

  // System transitions (timeout, resolution by incident closure)
  ['pending', 'timed_out'],
  ['accepted', 'timed_out'],
  ['acknowledged', 'timed_out'],
  ['en_route', 'resolved'], // Incident closed while en route
  ['on_scene', 'resolved'], // Normal resolution or incident closure
] as const

export function isValidDispatchTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return (DISPATCH_TRANSITIONS as readonly [string, string][]).some(
    ([f, t]) => f === from && t === to,
  )
}
