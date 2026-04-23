// Spec §5.3 — every valid report transition. Any transition not in this set
// is a rule violation and must be rejected server-side.
export const REPORT_TRANSITIONS = [
    ['draft_inbox', 'new'],
    ['draft_inbox', 'rejected'],
    ['new', 'awaiting_verify'],
    ['new', 'merged_as_duplicate'],
    ['awaiting_verify', 'verified'],
    ['awaiting_verify', 'merged_as_duplicate'],
    ['awaiting_verify', 'cancelled_false_report'],
    ['verified', 'assigned'],
    ['assigned', 'acknowledged'],
    ['acknowledged', 'en_route'],
    ['en_route', 'on_scene'],
    ['on_scene', 'resolved'],
    ['resolved', 'closed'],
    ['closed', 'reopened'],
    ['reopened', 'assigned'],
    // Any active state → cancelled (admin with reason)
    ['new', 'cancelled'],
    ['awaiting_verify', 'cancelled'],
    ['verified', 'cancelled'],
    ['assigned', 'cancelled'],
    ['acknowledged', 'cancelled'],
    ['en_route', 'cancelled'],
    ['on_scene', 'cancelled'],
];
export function isValidReportTransition(from, to) {
    return REPORT_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
//# sourceMappingURL=states.js.map