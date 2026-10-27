export type UserRole = 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin';
export type AccountStatus = 'active' | 'suspended' | 'disabled' | 'revoked';
export type ReportStatus = 'draft_inbox' | 'new' | 'awaiting_verify' | 'verified' | 'assigned' | 'acknowledged' | 'en_route' | 'on_scene' | 'resolved' | 'closed' | 'reopened' | 'rejected' | 'cancelled' | 'cancelled_false_report' | 'merged_as_duplicate';
export declare const ACTIVE_REPORT_STATUSES: readonly ReportStatus[];
export type DispatchStatus = 'pending' | 'accepted' | 'acknowledged' | 'en_route' | 'on_scene' | 'resolved' | 'declined' | 'timed_out' | 'cancelled' | 'superseded' | 'unable_to_complete' | 'needs_admin' | 'escalated';
export type Severity = 'low' | 'medium' | 'high';
export type ReportType = 'flood' | 'fire' | 'earthquake' | 'typhoon' | 'landslide' | 'storm_surge' | 'medical' | 'accident' | 'structural' | 'security' | 'other';
//# sourceMappingURL=enums.d.ts.map