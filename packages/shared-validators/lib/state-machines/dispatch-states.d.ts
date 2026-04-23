/**
 * Dispatch state machine — spec §5.4.
 *
 * Only responder-direct transitions are enforced at the Firestore rules layer.
 * Server-authoritative transitions (e.g. incident closure cascading to dispatch
 * resolution, or timeout → timed_out) live in Cloud Functions callables where
 * the full business logic is available.
 */
import type { DispatchStatus } from '../dispatches.js';
export declare const DISPATCH_STATES: readonly ["pending", "accepted", "acknowledged", "en_route", "on_scene", "resolved", "declined", "timed_out", "cancelled", "superseded"];
/**
 * Valid dispatch state transitions.
 *
 * Responder progression: pending → accepted → acknowledged → en_route → on_scene → resolved
 * Admin actions: cancel from mid-lifecycle states, supersede by dispatching another responder
 * Terminal states: resolved, declined, timed_out, cancelled, superseded
 */
export declare const DISPATCH_TRANSITIONS: Readonly<Record<DispatchStatus, readonly DispatchStatus[]>>;
export declare function isValidDispatchTransition(from: DispatchStatus, to: DispatchStatus): boolean;
//# sourceMappingURL=dispatch-states.d.ts.map