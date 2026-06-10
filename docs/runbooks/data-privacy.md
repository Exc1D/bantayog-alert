# Data Privacy Runbook

## Purpose

This document maps **what personal data is collected**, **where it lives**, **who can access it**, and **how long it is retained**. It supports LGU data privacy officers and compliance audits.

It covers the Bantayog Alert system as of the MVP pilot. Any schema change requires updating this document.

## What Data Is Collected

### Citizen-Facing Data

| Field              | Collection Point                      | Required | Purpose                                                               |
| ------------------ | ------------------------------------- | -------- | --------------------------------------------------------------------- |
| Display name       | Citizen PWA (via Firebase Auth)       | Yes      | Public-facing attribution in report (first name + last initial only). |
| Phone number       | Citizen PWA (Firebase Auth, optional) | No       | Future SMS notification target. Currently not sent or stored by us.   |
| Device location    | Citizen PWA (browser geolocation)     | No       | Embedded in report for responder routing.                             |
| Report photo/video | Citizen PWA (camera / gallery)        | No       | Incident documentation. Uploaded to Firebase Storage.                 |
| Report description | Citizen PWA (free text)               | Yes      | Triage and dispatch context.                                          |
| Report type        | Citizen PWA (dropdown)                | Yes      | Categorization (flood, fire, etc.).                                   |
| Report severity    | Citizen PWA (dropdown)                | Yes      | Triage priority.                                                      |

### Admin/Responder Operational Data

| Field                          | Collection Point                             | Required | Purpose                                              |
| ------------------------------ | -------------------------------------------- | -------- | ---------------------------------------------------- |
| Full name                      | Admin Desktop / Responder App (Auth profile) | Yes      | Audit trail (who performed what action).             |
| Assigned municipality / agency | Admin Desktop (role assignment)              | Yes      | Access control (admins only see their municipality). |
| Responder status updates       | Responder App (button taps)                  | Yes      | Citizen tracking timeline and dispatch lifecycle.    |
| Admin notes                    | Admin Desktop (rejection notes)              | Yes      | Moderation and triage justification.                 |
| Resolution summary             | Responder App (resolve dialog)               | Yes      | Final incident closure narrative.                    |

## Where PII Lives

### Firestore Collections

#### `reports/{id}`

- **Public fields:** `type`, `severity`, `status`, `locationGeohash`, `createdAt`, `publicTrackingRef`.
- **PII/Operational:** `description` (may contain identifying landmarks/names), `mediaUrls` (EXIF/GPS metadata is stripped at upload — stored files do not retain geolocation data), `createdBy` (Firebase UID — not reversible without Firebase Auth access).
- **Access:** Authenticated citizens (own reports only), admins (municipality-scoped), responders (assigned dispatches only).

#### `report_private/{id}`

- **Purpose:** Separation of PII from public-facing projections.
- **Fields:** `fullDescription`, `submitterContact` (if collected in future), `moderationNotes`, `adminNotes`, `internalTags`.
- **Access:** Admins only (municipality-scoped). Citizens never read this.

#### `report_lookup/{trackingRef}`

- **Purpose:** Citizen-safe anonymous lookup.
- **Fields:** `reportId` (string), `publicTrackingRef` (string). Nothing else.
- **No PII.** A citizen with only the `publicTrackingRef` can poll for status without auth.

#### `dispatches/{id}`

- **Fields:** `responderUid`, `assignedBy` (admin UID), `status`, `events[]`.
- **Access:** Assigned responder + admins for the report's municipality.

#### `users/{uid}` (managed by Firebase Auth, read via callable)

- **Fields:** `role`, `municipality`, `agency`, `displayName`.
- **Access:** Self + admins (municipality-scoped) + system callables.

#### `report_events/{id}` and `dispatch_events/{id}`

- **Fields:** Event log of status transitions. Includes `changedBy` (UID), `timestamp`, `fromStatus`, `toStatus`.
- **Access:** Admins (municipality-scoped). These are the audit trail.

### Firebase Storage

- **Path:** `reports/{reportId}/{mediaId}.{ext}`
- **Contents:** Photos and videos uploaded by citizens.
- **Metadata:** EXIF/GPS metadata is stripped on upload by the media finalize handler. Stored files do not retain geolocation data (verified by `functions/src/domains/media/__tests__/core.test.ts`).
- **Rules:** Only the submitting citizen, municipality admins, and assigned responders can read. Public unauthenticated read is denied.

### Firebase Authentication

- Managed by Firebase Auth. The app does not store passwords.
- UIDs are referenced in `reports.createdBy`, `dispatches.responderUid`, and event logs.
- Phone numbers (if provided) are held by Firebase Auth, not our Firestore.

## Retention Policy

| Data Category                         | Retention Period                          | Rationale                                             |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Active reports (`status != resolved`) | Until resolved + 30 days                  | Active incident lifecycle.                            |
| Resolved reports                      | 90 days after `resolvedAt`                | LGU reporting and reconciliation window.              |
| Resolved report media (Storage)       | 90 days after `resolvedAt`                | Matches report retention.                             |
| Rejected / false reports              | 30 days after rejection                   | Brief window for moderation appeal. Then hard-delete. |
| `report_events` / `dispatch_events`   | 1 year                                    | Audit and compliance trail.                           |
| `report_lookup` entries               | Same as parent report                     | Deleted when parent report is deleted.                |
| Admin notes / moderation incidents    | 1 year                                    | Compliance and oversight.                             |
| User profiles (`users/{uid}`)         | Indefinite (until user requests deletion) | Account continuity across pilots.                     |

## Erasure Procedures

### Citizen-Initiated Right to Erasure

A citizen may request deletion of their data. The process:

1. **Receive request** via the LGU privacy officer or designated email.
2. **Verify identity:** Confirm Firebase Auth UID ownership (e.g., via a signed-in session or phone verification).
3. **Queue for deletion:** Mark the user's data for erasure in a `deletion_queue/{uid}` document (admin-only callable `queueErasure`).
4. **Automated purge (daily Cloud Function):**
   - Delete all `reports` where `createdBy == uid`.
   - Delete all associated `report_private`, `report_lookup`, `dispatches`, `report_events`, `dispatch_events`.
   - Delete all Storage objects under `reports/{reportId}/*`.
   - Delete the user's `users/{uid}` document.
   - Delete the Firebase Auth user record (`admin.auth().deleteUser(uid)`).
5. **Confirmation:** Send email confirmation to the citizen within 72 hours of the automated purge.

**Current state (MVP pilot):** Steps 1-3 are manual. Step 4 runs via a scheduled Cloud Function (`scheduledErasure`). Step 5 is also manual. Full automation is a P2 feature.

### Admin-Initiated Moderation Deletion

If a report is identified as obviously false, abusive, or containing illegal content:

1. Mark the report as `rejected` with reason `obviously_false`.
2. Create a `report_private/{id}/moderationIncidents` document with timestamp, admin UID, and rationale.
3. If the report contains illegal content (CSAM, etc.), **do not delete it yet** — preserve it for law enforcement. Contact the LGU legal liaison.
4. After the 30-day rejection retention period, the report and all children are eligible for automated deletion.

## PII Exposure Scenarios and Response

### Scenario: Unauthorized Admin Reads Cross-Municipality Data

**Symptom:** Admin reports seeing reports from another municipality.
**Cause:** Likely a Firestore rules bug or callable authorization bypass.
**Response:**

1. Revoke the admin's session (`admin.auth().revokeRefreshTokens(adminUid)`).
2. Audit the admin's recent callable invocations via Cloud Functions logs.
3. Fix the rules or callable and re-run `pnpm test:rules`.
4. Document the incident in `report_private/{id}/moderationIncidents`.

### Scenario: Citizen Sees Another Citizen's Report via Tracking

**Symptom:** Citizen enters a tracking ref and sees another person's report.
**Cause:** Either the tracking ref was leaked/shared, or a `report_lookup` collision occurred.
**Response:**

1. `report_lookup` uses random 8-character alphanumeric refs. Collision probability is extremely low but non-zero.
2. If confirmed: rotate the `publicTrackingRef` for both reports, invalidate the old lookup entries, and notify affected citizens.
3. Add collision detection to the report creation callable (P2).

### Scenario: Media Metadata Leaks GPS Coordinates

**Symptom:** Photo downloaded from Storage reveals precise home location via EXIF.
**Mitigation:** EXIF/GPS metadata is stripped automatically at upload by the media finalize handler (verified by `functions/src/domains/media/__tests__/core.test.ts`). Stored files do not retain geolocation data. During a pilot:

1. For high-risk submissions (domestic violence, stalking), the admin should still mark the report for manual review regardless of automated stripping.
2. Re-run the media finalize test suite (`pnpm --filter @bantayog/functions test:unit media`) after any Storage handler changes.

## Data Transfer and Third Parties

- **Firebase / Google Cloud:** Hosting, Firestore, Auth, Functions, Storage. Governed by Google Cloud terms.
- **Map tile provider (OpenStreetMap / MapLibre):** Client-side only. No PII sent to tile servers beyond standard HTTP headers and viewport bounding boxes.
- **No other third parties** in the MVP pilot. No analytics, no ad trackers, no CRM integrations.

## LGU Compliance Checklist

Before offering the system to an LGU pilot, confirm:

- [ ] This runbook has been shared with the LGU data privacy officer.
- [ ] Retention periods align with LGU records management policy.
- [ ] The LGU has a designated contact for citizen erasure requests.
- [ ] The LGU understands that EXIF metadata is stripped automatically at upload and stored files do not retain GPS data (verified by `functions/src/domains/media/__tests__/core.test.ts`).
- [ ] The LGU agrees that rejected reports are retained for 30 days before automated deletion.
- [ ] The LGU agrees that event logs are retained for 1 year for audit purposes.
- [ ] A test erasure request has been performed in staging to validate the procedure.

## Related Runbooks

- [Rollback Runbook](./rollback.md) — Reverting bad deploys.
- [Incident Response Runbook](./incident-response.md) — System failure procedures.
- [Pilot Demo Runbook](./pilot-demo.md) — Local setup and demo procedures.
