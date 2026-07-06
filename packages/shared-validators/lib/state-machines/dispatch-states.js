/**
 * Dispatch state machine — spec §5.4.
 *
 * Only responder-direct transitions are enforced at the Firestore rules layer.
 * Server-authoritative transitions (e.g. incident closure cascading to dispatch
 * resolution, or timeout → timed_out) live in Cloud Functions callables where
 * the full business logic is available.
 */
// Spec §5.4 — dispatch lifecycle states (Phase 3c: en_route + on_scene, hardened: needs_admin + escalated)
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
    'unable_to_complete',
    'needs_admin',
    'escalated',
];
export const CANCELLABLE_DISPATCH_STATUSES = [
    'pending',
    'accepted',
    'acknowledged',
    'en_route',
    'on_scene',
    'escalated',
];
/**
 * Valid dispatch state transitions.
 *
 * Responder progression: pending → accepted → acknowledged → en_route → on_scene → resolved
 * Admin actions: cancel from mid-lifecycle states, supersede by dispatching another responder
 * Server-only: pending → needs_admin (deadline exceeded, no candidates), pending → escalated (re-assigned)
 * Terminal states: resolved, declined, timed_out, cancelled, superseded, unable_to_complete, needs_admin
 */
export const DISPATCH_TRANSITIONS = {
    pending: [
        'accepted',
        'declined',
        'cancelled',
        'timed_out',
        'superseded',
        'needs_admin',
        'escalated',
    ],
    accepted: ['acknowledged', 'cancelled', 'superseded', 'unable_to_complete'],
    acknowledged: ['en_route', 'cancelled', 'superseded', 'unable_to_complete'],
    en_route: ['on_scene', 'cancelled', 'superseded', 'unable_to_complete'],
    on_scene: ['resolved', 'cancelled', 'superseded', 'unable_to_complete'],
    resolved: [],
    declined: [],
    timed_out: [],
    cancelled: [],
    superseded: [],
    unable_to_complete: [],
    needs_admin: [], // terminal — admin must manually re-dispatch
    escalated: ['accepted', 'declined', 'cancelled', 'timed_out', 'superseded', 'needs_admin'],
};
export function isValidDispatchTransition(from, to) {
    return DISPATCH_TRANSITIONS[from].includes(to);
}
//# sourceMappingURL=dispatch-states.js.map