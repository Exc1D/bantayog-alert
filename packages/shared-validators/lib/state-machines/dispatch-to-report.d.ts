/**
 * Mirror trigger helper: maps dispatch state to report state.
 *
 * Used by dispatch-mirror-to-report trigger to synchronize responder
 * progression back to the parent report document.
 *
 * NOTE: Returns `null` for terminal/failure states (pending, declined,
 * timed_out, cancelled, superseded) because those states are handled
 * by the cancelDispatch callable or require explicit admin action.
 */
import type { DispatchStatus } from '../dispatches.js';
import type { ReportStatus } from './report-states.js';
export declare function dispatchToReportState(dispatchStatus: DispatchStatus): ReportStatus | null;
//# sourceMappingURL=dispatch-to-report.d.ts.map