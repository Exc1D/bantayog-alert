/**
 * Dispatch state machine — spec §5.4.
 *
 * Only responder-direct transitions are enforced at the Firestore rules layer.
 * Server-authoritative transitions (e.g. incident closure cascading to dispatch
 * resolution, or timeout → timed_out) live in Cloud Functions callables where
 * the full business logic is available.
 */
import type { DispatchStatus } from '@bantayog/shared-types';
export declare const DISPATCH_STATES: readonly ["pending", "accepted", "acknowledged", "en_route", "on_scene", "resolved", "declined", "timed_out", "cancelled", "superseded", "unable_to_complete", "needs_admin", "escalated"];
export declare const CANCELLABLE_DISPATCH_STATUSES: readonly ["pending", "accepted", "acknowledged", "en_route", "on_scene"];
/**
 * Valid dispatch state transitions.
 *
 * Responder progression: pending → accepted → acknowledged → en_route → on_scene → resolved
 * Admin actions: cancel from mid-lifecycle states, supersede by dispatching another responder
 * Server-only: pending → needs_admin (deadline exceeded, no candidates), pending → escalated (re-assigned)
 * Terminal states: resolved, declined, timed_out, cancelled, superseded, unable_to_complete, needs_admin
 */
export declare const DISPATCH_TRANSITIONS: Readonly<Record<DispatchStatus, readonly DispatchStatus[]>>;
export declare function isValidDispatchTransition(from: DispatchStatus, to: DispatchStatus): boolean;
//# sourceMappingURL=dispatch-states.d.ts.map