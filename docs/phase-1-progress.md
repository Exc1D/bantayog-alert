# Phase 1 Progress

## 2026-06-07 - Phase 1A Citizen Report Form Improvements

- Added the MVP Citizen report fields: short description, people injured, people trapped, location confidence, and optional urgency reason.
- Replaced the Citizen wizard's hardcoded severity with `deriveReportSeverity`, using trapped/injured signals plus incident type.
- Preserved the existing three-step wizard, local draft, offline retry, idempotency, public reference, secret, and photo behavior.
- Added triage payload persistence from wizard snapshot to draft, callable submission, shared validator schema, and `report_ops` materialization.
- Kept Phase 1A narrow: no admin triage console, SMS work, Firestore rules/index edits, deploy config, or new dependencies.

## Next

- Phase 1B: Admin Triage Console.
