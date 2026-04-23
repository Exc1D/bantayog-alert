/**
 * State machine transition tables.
 *
 * These are the codegen source-of-truth for both TypeScript and Firestore rules
 * transition tables (see `scripts/build-rules.ts`). Any transition not in the
 * declared set must be rejected at the rules layer.
 */
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types';
export type { ReportStatus, DispatchStatus };
export declare const REPORT_STATES: readonly ["draft_inbox", "new", "awaiting_verify", "verified", "assigned", "acknowledged", "en_route", "on_scene", "resolved", "closed", "reopened", "rejected", "cancelled", "cancelled_false_report", "merged_as_duplicate"];
export declare const REPORT_TRANSITIONS: readonly [ReportStatus, ReportStatus][];
export { DISPATCH_STATES } from './dispatch-states.js';
export { DISPATCH_TRANSITIONS } from './dispatch-states.js';
export declare function isValidReportTransition(from: ReportStatus, to: ReportStatus): boolean;
//# sourceMappingURL=report-states.d.ts.map