// Branded string types — prevent mixing IDs of different entities at compile time.
// Runtime cost: zero. Compile-time benefit: entire class of "wrong ID passed" bugs eliminated.
// Cast helpers — only use at validated boundaries (after Zod parse or similar).
export const asReportId = (v) => v;
export const asDispatchId = (v) => v;
export const asUserUid = (v) => v;
export const asAgencyId = (v) => v;
export const asMunicipalityId = (v) => v;
export const asBarangayId = (v) => v;
export const asAlertId = (v) => v;
export const asEmergencyId = (v) => v;
export const asIncidentId = (v) => v;
export const asHazardZoneId = (v) => v;
export const asHazardZoneVersion = (v) => v;
export const asDispatchRequestId = (v) => v;
export const asCommandThreadId = (v) => v;
export const asCommandMessageId = (v) => v;
export const asShiftHandoffId = (v) => v;
export const asMassAlertRequestId = (v) => v;
export const asMediaRef = (v) => v;
export const asPublicTrackingRef = (v) => v;
export const asIdempotencyKey = (v) => v;
//# sourceMappingURL=branded.js.map