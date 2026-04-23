/**
 * State machine barrel — re-exports ReportStatus, DispatchStatus, and helpers
 * so consumers get a single import point.
 */
export { REPORT_STATES, REPORT_TRANSITIONS, isValidReportTransition } from './report-states.js';
export type { ReportStatus } from './report-states.js';
export { DISPATCH_STATES, DISPATCH_TRANSITIONS, isValidDispatchTransition, } from './dispatch-states.js';
export type { DispatchStatus } from '../dispatches.js';
export { dispatchToReportState } from './dispatch-to-report.js';
//# sourceMappingURL=index.d.ts.map