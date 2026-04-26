/**
 * Dispatch state machine — spec §5.4.
 *
 * Only responder-direct transitions are enforced at the Firestore rules layer.
 * Server-authoritative transitions (e.g. incident closure cascading to dispatch
 * resolution, or timeout → timed_out) live in Cloud Functions callables where
 * the full business logic is available.
 */
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
    'unable_to_complete',
];
/**
 * Valid dispatch state transitions.
 *
 * Responder progression: pending → accepted → acknowledged → en_route → on_scene → resolved
 * Admin actions: cancel from mid-lifecycle states, supersede by dispatching another responder
 * Terminal states: resolved, declined, timed_out, cancelled, superseded, unable_to_complete
 */
export const DISPATCH_TRANSITIONS = {
    pending: ['accepted', 'declined', 'cancelled', 'timed_out', 'superseded'],
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
};
export function isValidDispatchTransition(from, to) {
    return DISPATCH_TRANSITIONS[from].includes(to);
}
//# sourceMappingURL=dispatch-states.js.map