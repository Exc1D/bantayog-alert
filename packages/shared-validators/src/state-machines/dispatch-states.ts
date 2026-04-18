/**
 * Dispatch state machine — spec §5.4.
 *
 * Only responder-direct transitions are enforced at the Firestore rules layer.
 * Server-authoritative transitions (e.g. incident closure cascading to dispatch
 * resolution, or timeout → timed_out) live in Cloud Functions callables where
 * the full business logic is available.
 */
export {
  DISPATCH_STATES,
  DISPATCH_TRANSITIONS,
  isValidDispatchTransition,
} from './report-states.js'
export type { DispatchStatus } from '@bantayog/shared-types'
