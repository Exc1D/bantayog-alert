# Geoanalytics & Hazard Mapping — Design Spec

**Feature:** Geoanalytics & Hazard Mapping
**Design doc version:** 1.0
**Target spec versions:**
- Architecture Spec v7.0 → v7.1 (adds §22, decision log #46–#51, SLO/risk/test/pilot-acceptance amendments)
- Municipal Admin Role Spec v2.0 → v2.1 (adds hazard capabilities)
- Provincial Superadmin Role Spec v2.0 → v2.1 (adds hazard capabilities)
- Citizen / Responder / Agency Admin Role Specs v2.0 → v2.1 (explicit "no hazard access" notes only)

**Date:** 2026-04-16
**Status:** Approved design — ready for implementation plan
**Supersedes:** None (net-new feature)
**Source brainstorming session:** `/superpowers:brainstorming` on 2026-04-16

**Prior specs referenced:**
- `docs/superpowers/specs/bantayog-alert-architecture-spec-v7.md`
- `docs/roles/citizen-role-spec-v2.md`
- `docs/roles/responder-role-spec-v2.md`
- `docs/roles/municipal-admin-role-spec-v2.md`
- `docs/roles/agency-admin-role-spec-v2.md`
- `docs/roles/provincial-superadmin-role-spec-v2.md`

---

## 0. Brainstorming Decision Record

Options resolved during brainstorming, recorded here for audit:

| # | Question | Options | Chosen |
|---|---|---|---|
| 1 | Feature scope ambition | A: overlay only / B: overlay + analytics / C: overlay + custom zones / D: full-featured | **D** |
| 2 | Spatial indexing strategy | A: Cloud Storage + in-CF / B: Firestore-native geohash / C: BigQuery GIS authoritative / D: hybrid | **D** |
| 3 | Custom zone authorship × lifecycle × mass-alert integration | X1/X2/X3 × Y1/Y2/Y3 × Z1/Z2 | **X2 + Y2 + Z2** |
| 4 | Hazard types + data source | A/B/C/D × 1/2/3 | **B + 1** (typhoon triumvirate + manual Superadmin upload) |
| 5 | Re-tagging policy on zone change | A: forward-only / B: always-sweep / C: hybrid | **C** |

Additional decisions during section review:
- **Split delivery.** This doc covers the hazard feature only. Role-spec reconciliation from "Aligned to v6.0" to v7.1 is a separate brainstorming/plan cycle after this one.
- **Agency Admin has no hazard access.** No reads, no writes, no map overlay, no analytics access. Matches their scope (vertical authority over own agency, no LGU triage tools).
- **Municipal admin reads narrowed.** Muni admin reads reference layers (all — they cover the province-wide hazard landscape including own muni) plus own-muni custom zones. Does NOT read provincial-scope custom zones authored by Superadmin; Superadmin coordinates with affected munis via Command Channel threads instead.
- **No new MFA surface.** Hazard mutations ride the existing privileged-admin envelope (TOTP, re-auth intervals, `isActivePrivileged()`).

---

## 1. Scope & Delivery Model

### 1.1 What this feature does

Municipal and Provincial admins get a hazard-zone overlay on the admin map, backed by a hybrid spatial store. Two kinds of zones:
- **Reference layers:** Superadmin-uploaded flood / landslide / storm-surge polygons from PAGASA and MGB, versioned and immutable.
- **Custom zones:** Admin-drawn, event-bounded with `expiresAt`, used for operational situations (typhoon impact, evacuation, curfew).

Every new report is auto-tagged at ingest with the zones it falls inside. Custom zone edits trigger a bounded sweeper that re-tags affected existing reports; reference-layer versions do not sweep (history preserved). Mass alerts can target a polygon, with existing §3 routing thresholds unchanged. All zone mutations are `isActivePrivileged()`-gated and audit-streamed (not batched).

### 1.2 What this feature is NOT

- **Not a hazard modeling spec.** Risk scoring formulas beyond "count of tagged reports per zone" are deferred to v8 pending pilot data.
- **Not an integration spec.** No automated pipelines with PAGASA / MGB / PHIVOLCS APIs. All data enters via Superadmin manual upload.
- **Not a forecasting spec.** Zones describe known risk, not forecast events. Typhoon-track projection overlays are NDRRMC / PAGASA's job.
- **Not a UX spec.** This doc defines capabilities, boundaries, and data. Pixel-level layout, copy, and iconography belong to a later `frontend-design` pass.
- **Not a migration spec.** Net-new schema; no existing data is transformed.

### 1.3 Surfaces affected

| Surface | Change | Scale |
|---|---|---|
| Architecture Spec v7 → v7.1 | New §22; decision log #46–#51; §13.2 / §13.7 / §13.9 / §14 / §15 / §16 / §20 amendments; §5.9 index additions | Medium |
| Municipal Admin Role v2.0 → v2.1 | New hazard capabilities in §2.1 / §2.2 / §4 / §6 / §8 | Medium |
| Provincial Superadmin Role v2.0 → v2.1 | New hazard sections in §2 / §3 / §4 / §5 / §9 | Medium |
| Citizen Role v2.0 → v2.1 | One row in §2.2 "cannot do" | Small |
| Responder Role v2.0 → v2.1 | One row in §2.2 "cannot do" | Small |
| Agency Admin Role v2.0 → v2.1 | One row in §2.2 "cannot do" | Small |

---

## 2. Data Model & Storage

### 2.1 New Firestore collection: `hazard_zones/{zoneId}`

Primary indexed/editable zone store. Single collection holds both reference layers and custom zones, discriminated by `zoneType`.

```typescript
interface HazardZone {
  // Identity
  zoneId: string                             // ULID
  zoneType: 'reference' | 'custom'
  hazardType: 'flood' | 'landslide' | 'storm_surge'

  // Geographic scope
  scope: 'provincial' | 'municipal'
  municipalityId?: string                    // required when scope === 'municipal'

  // Indexed geometry — simplified, bounded
  geohashPrefix: string                      // 6-char prefix for bbox lookup
  bbox: { minLat: number, minLng: number, maxLat: number, maxLng: number }
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon  // vertex cap from system_config/hazard_zone_limits.maxVertices (default 500), enforced server-side
  geometryStorageUrl?: string                // Cloud Storage URL for unsimplified source (reference layers only)

  // Reference-layer specific
  sourceAgency?: 'PAGASA' | 'MGB' | 'OTHER'
  sourceVersion?: string                     // admin-supplied, e.g. "2024-08"
  supersededBy?: string                      // zoneId of newer version
  supersededAt?: Timestamp

  // Custom-zone specific
  expiresAt?: Timestamp                      // REQUIRED when zoneType === 'custom'; server enforces > now + 5min, ≤ now + 30d
  expiredAt?: Timestamp                      // set by expiration sweep when expiresAt passes
  purpose?: 'typhoon_impact' | 'evacuation' | 'curfew' | 'other'
  purposeDescription?: string                // ≤280 chars, server-sanitized

  // Risk metadata
  severity: 'high' | 'medium' | 'low'        // authored

  // Attribution
  createdBy: string                          // uid
  createdByRole: 'municipal_admin' | 'provincial_superadmin'
  createdByMunicipalityId?: string           // denormalized for rule evaluation
  createdAt: Timestamp
  updatedAt: Timestamp
  updatedBy?: string
  deletedAt?: Timestamp
  deletedBy?: string

  // Versioning
  version: number                            // monotonic per zoneId
  schemaVersion: number
}
```

**Subcollection:** `hazard_zones/{zoneId}/history/{version}` — snapshot of prior zone state written before each edit. Read-only after write; CF Admin SDK is the only writer. Each history doc carries denormalized `zoneType` and `municipalityId` fields (written at creation time), so security rules can scope reads without a `get()` on the parent zone.

### 2.2 Touch points on existing schemas

**`report_ops/{reportId}`** — two new fields:

```typescript
locationGeohash?: string           // 6-char geohash of exact GPS location; enables sweep queries without reading report_private
hazardZoneIds?: HazardTag[]       // append-only tag history (audit-grade)
hazardZoneIdList?: string[]        // flat array — queryable via array-contains

interface HazardTag {
  zoneId: string
  zoneVersion: number
  hazardType: 'flood' | 'landslide' | 'storm_surge'
  severity: 'high' | 'medium' | 'low'
  taggedAt: Timestamp
  taggedBy: 'ingest' | 'zone_sweep'
}
```

**Field rationale:**
- `locationGeohash` is denormalized from `report_private.exactLocation` during triptych materialization. This enables the zone sweeper (§4.4) to query reports by location without reading `report_private` (which would flood the streaming audit path with bulk privileged reads). Follows the same denormalization pattern as `status` / `severity` / `createdAt` (§5.1 of arch spec). Only set when `locationPrecision === 'gps'`.
- `hazardZoneIds` + `hazardZoneIdList` dual representation: Firestore's `array-contains` requires exact primitive match. The map list carries audit history; the flat list makes "filter reports by zone" queryable without client-side scan. Both maintained atomically in the same write.

**`reports/{reportId}`** — NO change. Hazard tags are operational (not public-alertable) and sit behind `isActivePrivileged()` on `report_ops`. Matches §5.1 triptych principle.

**`mass_alert_requests/{requestId}`** — polygon targeting support:

```typescript
targetType: 'barangay' | 'municipality' | 'polygon'   // discriminator
targetGeometry?: {
  zoneId?: string                                      // if using an existing zone
  bbox: { minLat, minLng, maxLat, maxLng }
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon     // ≤500 vertices, same cap
}
```

Existing §3 routing logic unchanged: ≤5k single-muni stays direct, anything larger escalates to NDRRMC. Polygon is just a new target geometry, not a new channel.

### 2.3 Cloud Storage layout

Bucket: `bantayog-hazards-{env}` (not public; Admin SDK only).

```
reference/
  flood/
    v2024.1/
      {zoneId}.geojson              # unsimplified source
      manifest.json                 # source agency, upload date, uploader uid
  landslide/
    v2024.1/...
  storm_surge/
    v2024.1/...
custom/
  {zoneId}/
    v1.geojson                      # snapshot on each edit
    v2.geojson
```

Storage rules:
- Bucket IAM: `storage.objectViewer` to the Firebase service account only
- No client-side upload; writes via `requestHazardUploadUrl` + `uploadHazardReferenceLayer` callables under Admin SDK
- Object versioning enabled; 24-month retention on non-current versions

### 2.4 BigQuery mirror

Two tables, updated via the same 5-min batch pipeline that handles audit export (§12.2 batch path):

```sql
CREATE TABLE hazards.zones (
  zone_id STRING NOT NULL,
  zone_type STRING,                         -- 'reference' | 'custom'
  hazard_type STRING,
  scope STRING,
  municipality_id STRING,
  severity STRING,
  geometry GEOGRAPHY,                       -- native spatial type
  source_agency STRING,
  source_version STRING,
  expires_at TIMESTAMP,
  expired_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  superseded_at TIMESTAMP,
  deleted_at TIMESTAMP,
  version INT64
) PARTITION BY DATE(created_at) CLUSTER BY municipality_id, hazard_type;

CREATE TABLE hazards.report_tags (
  report_id STRING NOT NULL,
  zone_id STRING NOT NULL,
  zone_version INT64,
  hazard_type STRING,
  severity STRING,
  tagged_at TIMESTAMP,
  tagged_by STRING,                         -- 'ingest' | 'zone_sweep'
  municipality_id STRING,
  report_created_at TIMESTAMP,
  report_severity STRING,
  report_status STRING                      -- snapshot at export time
) PARTITION BY DATE(tagged_at) CLUSTER BY municipality_id, hazard_type;
```

Analytics queries use native `ST_Contains` / `ST_Area` / `ST_Within`. Denormalized `municipality_id`, `hazard_type`, `severity` on `report_tags` means the common admin query needs no join; clustering keeps it fast.

**BigQuery is for analytics (aggregate queries, time-windowed reports, compliance forensics), not operational truth.** Zone version status, custom zone active lists, and any admin UI that must reflect just-committed state reads from Firestore directly. BigQuery mirror lag (up to 5 min) is acceptable for trend dashboards and compliance queries, but not for the version-status panel where a superadmin validates an upload they just performed. This split is consistent with the existing §9.1 state-ownership principle: Firestore SDK is the authoritative client-side view of server state.

### 2.5 Composite indexes (add to `firestore.indexes.json`)

| Collection | Index | Purpose |
|---|---|---|
| `hazard_zones` | `zoneType ASC, hazardType ASC, createdAt DESC` | Admin list by type |
| `hazard_zones` | `scope ASC, municipalityId ASC, zoneType ASC, createdAt DESC` | Muni admin's zone list |
| `hazard_zones` | `geohashPrefix ASC, deletedAt ASC, hazardType ASC` | Ingest auto-tag candidate lookup |
| `hazard_zones` | `expiresAt ASC, zoneType ASC, deletedAt ASC` | Expiration sweeper |
| `report_ops` | `municipalityId ASC, hazardZoneIdList ARRAY, createdAt DESC` | Admin filter "reports in zone X" |
| `report_ops` | `locationGeohash ASC, createdAt DESC` | Zone sweep candidate lookup by geohash prefix |

### 2.6 Rationale for shape choices

- **Why Firestore-indexed zones (not pure Cloud Storage)?** Auto-tag at ingest needs a fast candidate lookup; Cloud Storage read per inbox event adds 50–200ms and breaks the p95 < 3s ingest SLO under surge.
- **Why not pure BigQuery for zones?** Auto-tag at ingest can't afford a BigQuery query per report (cost + latency). BigQuery is the analytics mirror, not the operational source of truth.
- **Why dual `hazardZoneIds` + `hazardZoneIdList`?** Firestore array-contains needs primitive equality. Map list carries audit history; flat list enables "filter reports by zone" server-side.
- **Why hazard tags on `report_ops`, not `reports`?** Operational data; stays behind `isActivePrivileged()`. Citizens never see hazard-zone metadata.
- **Why geohash prefix length 6 (stored) / 4 (queried)?** Stored 6-char (~1.2km) is precise enough for zone indexing. Queried as 4-char prefix (~20km) over-reads candidates but eliminates boundary-miss errors; Turf.js is the authoritative filter.
- **Why version reference layers by creating new `zoneId`s (not in-place)?** A report tagged with v2024 must stay attributed to v2024 after v2025 uploads. Immutable versioning is the clean model.
- **Why `locationGeohash` on `report_ops` (denormalized from `report_private`)?** The zone sweeper (§4.4) needs to query reports by location. Exact GPS lives on `report_private`, which is audit-streamed on every privileged read. A bulk sweep reading thousands of `report_private` docs would flood the streaming audit path. Denormalizing a 6-char geohash (precision ~1.2km) onto `report_ops` solves this — the sweeper never touches `report_private`. Same pattern as `status`/`severity`/`createdAt` denormalization.
- **Why auto-tag runs AFTER the triptych transaction, not inside it?** Adding `hazard_zones` reads to the triptych transaction expands its read set. Any concurrent zone edit causes the transaction to retry. Under surge + zone edit, this creates a retry storm on the life-safety-critical ingest path. Separating auto-tag as a follow-up write keeps the report materialization robust; tagging failure falls to the dead-letter + sweep safety net.

---

## 3. Authorization Model

### 3.1 Firestore rules — new block

```javascript
// --- Hazard zones ---
match /hazard_zones/{zoneId} {
  allow read: if isActivePrivileged() && (
    isSuperadmin()
    || (isMuniAdmin() && (
      resource.data.zoneType == 'reference'
      || resource.data.municipalityId == myMunicipality()
    ))
  );
  // All mutations callable-only (geometry simplification + audit streaming can't be expressed in rules)
  allow create, update, delete: if false;

  match /history/{version} {
    // Denormalized zoneType + municipalityId on each history doc — no get() needed.
    // Written at history-creation time by CF; immutable after write.
    allow read: if isActivePrivileged() && (
      isSuperadmin()
      || (isMuniAdmin() && (
        resource.data.zoneType == 'reference'
        || resource.data.municipalityId == myMunicipality()
      ))
    );
    allow write: if false;
  }
}
```

**Design notes:**

- **Muni admin read scope** narrowed to: all reference layers (province-wide hazard data, needed for muni-area coverage) + own-muni custom zones only. Provincial-scope custom zones are invisible; Superadmin loops in affected munis via Command Channel threads.
- **Agency Admin / Responder / Citizen** have no read path → default-deny applies. Matches confirmed scope decisions.
- **History subcollection reads** use denormalized `zoneType` and `municipalityId` fields on each history doc (written at creation by CF). No `get()` needed — avoids unbounded billable reads when superadmin bulk-reviews zone histories post-typhoon or inspects reference layer versions in the management panel.
- **CI negative tests required:** muni admin attempting to read other-muni custom zone fails; agency admin attempting any read fails; responder / citizen attempting any read fails; non-admin attempting any write fails.

### 3.2 Existing rules touched

- **`report_ops`** — rule unchanged (already callable-only write). New fields added by CF transactions under Admin SDK.
- **`mass_alert_requests`** — rule unchanged. New `targetType` / `targetGeometry` fields validated inside callable.

### 3.3 Cloud Storage rules

```
service firebase.storage {
  match /b/bantayog-hazards-{env}/o {
    match /{allPaths=**} {
      allow read, write: if false;  // Admin SDK only
    }
  }
}
```

### 3.4 New callables

| Callable | Actor Role | Purpose |
|---|---|---|
| `uploadHazardReferenceLayer` | `provincial_superadmin` | Upload new reference-layer version for one `hazardType`. Writes source GeoJSON to Cloud Storage + simplified polygons to Firestore as new zone IDs. |
| `supersedeHazardReferenceLayer` | `provincial_superadmin` | Mark prior version's zones `supersededAt`; clients stop rendering, history preserved. |
| `createCustomHazardZone` | `municipal_admin`, `provincial_superadmin` | Create event-bounded custom zone. Muni admin limited to `scope: 'municipal'` with own `municipalityId`. |
| `updateCustomHazardZone` | `municipal_admin`, `provincial_superadmin` | Edit geometry / `expiresAt` / `purposeDescription` / `severity`. Muni admin scoped by `municipalityId == own` (any zone in own muni, regardless of who authored it); Superadmin scoped to any custom zone. Authorship is an audit field, not an authorization boundary (Principle #11). |
| `deleteCustomHazardZone` | `municipal_admin`, `provincial_superadmin` | Soft-delete (sets `deletedAt`, `deletedBy`). Same municipality scope as update — any muni admin can delete any custom zone in own muni. Superadmin can delete any. Reference zones cannot be deleted, only superseded. |
| `requestHazardUploadUrl` | `provincial_superadmin` | Signed Cloud Storage URL for reference-layer upload (10-min expiry, Content-Type + size restricted). |

### 3.5 Existing callables extended

| Callable | Extension |
|---|---|
| `massAlertReachPlanPreview` | Accept `targetType: 'polygon'` with `targetGeometry`. Reverse-geocodes polygon to affected barangays for recipient estimate + routing decision. |
| `sendMassAlert` | Accept polygon targets. Same ≤5k + single-muni routing; polygon crossing muni boundaries always escalates. |
| `requestMassAlertEscalation` | Accept polygon targets. `mass_alert_requests/{id}.targetGeometry` carries polygon to NDRRMC escalation. |
| `processInboxItem` (trigger) | Inside existing materialization transaction: geohash-prefix query + Turf.js point-in-polygon → `hazardZoneIds[]` + `hazardZoneIdList[]` on `report_ops`. Adds ~10–20ms. |

### 3.6 New triggers

| Trigger | Function | Purpose |
|---|---|---|
| `onWrite hazard_zones/{zoneId}` where `zoneType === 'custom'` | `hazardZoneSweep` | Recompute bbox delta (old ∪ new), geohash-prefix query on `reports`/`report_ops`, re-tag affected reports atomically. Idempotent on `(zoneId, version)`. |
| Scheduled every 5 min | `hazardTagBackfillSweep` | Queries `report_ops` where `locationGeohash != null AND hazardZoneIds == null AND createdAt > now - 90d`. Tags untagged reports. Primary recovery for ingest auto-tag failures. Same pattern as `inboxReconciliationSweep`. |
| Scheduled hourly | `hazardZoneExpirationSweep` | Mark zones past `expiresAt` with `expiredAt`. Does NOT remove tags. |
| Scheduled 5-min | `hazardReferenceBigQueryMirror` | Export zone + tag deltas to BigQuery `hazards.*`. Reuses existing audit batch pipeline. |

### 3.7 Audit streaming classification

Per §12.2 (streaming for security-critical, batch for routine):

**Streaming path** (< 60s SLO):
- `uploadHazardReferenceLayer` / `supersedeHazardReferenceLayer`
- `createCustomHazardZone` / `updateCustomHazardZone` / `deleteCustomHazardZone`
- Polygon-targeted mass-alert sends (already streaming path for non-polygon; no new classification)

**Batch path** (5-min):
- `hazardZoneSweep` tag mutations on `report_ops` (high volume, derivable from streamed zone events)
- `hazardZoneExpirationSweep` (automatic, time-based)
- BigQuery mirror exports (meta-pipeline)

### 3.8 MFA + session

No new MFA surface. Hazard mutations inherit existing Admin Desktop privilege posture:
- Superadmin: TOTP + 4h re-auth
- Muni admin: TOTP + 8h re-auth
- `isActivePrivileged()` check on every callable

### 3.9 Rate limits

Per `rate_limits/{key}` framework:

| Callable | Limit |
|---|---|
| `uploadHazardReferenceLayer` | 10/day per superadmin |
| `createCustomHazardZone` | 50/day per admin |
| `updateCustomHazardZone` | 100/day per admin |
| `deleteCustomHazardZone` | 20/day per admin |

Hard limit returns structured error; soft limit (80% of cap) logs moderation-elevation per §7.1 pattern.

**Emergency rate-limit elevation.** During a declared emergency (§7.5 `declareEmergency`) or active surge pre-warm (§10.2), all hazard zone rate limits are multiplied by `system_config/hazard_zone_limits.emergencyMultiplier` (default: 5×). Same mechanism as the `minInstances` pre-warm — automatic, logged, reverts when the emergency declaration ends. This prevents the 50/day custom zone cap from pinching a muni admin drawing rapid-evolving evacuation zones during typhoon landfall.

### 3.10 Deny matrix

| Role | Read `hazard_zones` | Read history | Call any hazard callable | Polygon-target mass alert |
|---|---|---|---|---|
| Citizen | ❌ | ❌ | ❌ | ❌ |
| Responder | ❌ | ❌ | ❌ | ❌ |
| Agency Admin | ❌ | ❌ | ❌ | ❌ |
| Municipal Admin | ✅ reference + own-muni custom | ✅ for readable zones | ✅ own-muni custom (any author) | ✅ own muni (≤5k) or escalate |
| Provincial Superadmin | ✅ all | ✅ all | ✅ all | ✅ with Reach Plan |

All denials get explicit CI negative tests per §5.7.

---

## 4. Functional Flows

### 4.1 Reference layer upload (Superadmin)

1. Superadmin downloads hazard maps from source agency via their own channel.
2. Converts locally to GeoJSON; prepares manifest (source agency, version string, date).
3. Admin Desktop → Hazard Layers → Upload. Selects `hazardType`, enters `sourceAgency`, `sourceVersion`, re-enters TOTP.
4. Client calls `requestHazardUploadUrl` → signed Cloud Storage URL (10-min expiry, Content-Type + size restricted).
5. Client uploads GeoJSON to temp path.
6. Client calls `uploadHazardReferenceLayer` with temp path + metadata.
7. Callable server-side:
   - Loads GeoJSON from temp path; validates schema
   - For each feature: Douglas-Peucker simplification to `system_config/hazard_zone_limits.maxVertices` (default 500), computes bbox + 6-char geohash prefix, assigns new `zoneId`
   - Writes `hazard_zones` docs with `zoneType: 'reference'`, `scope: 'provincial'`
   - Writes source GeoJSON to permanent path `reference/{hazardType}/{sourceVersion}/{zoneId}.geojson`
   - Streams audit event per new zone
   - Returns summary: zones created, vertices before/after, rejected features with reasons
8. Superseding: Superadmin calls `supersedeHazardReferenceLayer(oldVersion, newVersion)`; marks old zones `supersededBy` + `supersededAt`.

**Why upload and supersede are separated:** Superadmin can stage a new version, inspect, then flip. Matches the pattern of §7.5.1 NDRRMC escalation (create pending, then activate).

### 4.2 Custom zone create (Muni admin or Superadmin)

1. Admin draws polygon on map with Leaflet-Draw (or pastes GeoJSON for power users).
2. Client-side validation: vertex count ≤500, closed polygon, bbox inside jurisdiction (for muni admin).
3. Admin fills required fields: `hazardType`, `purpose`, `severity`, `expiresAt` (required, must be future, ≤30 days out).
4. Client calls `createCustomHazardZone`.
5. Callable:
   - Validates `isActivePrivileged()`, jurisdiction match (muni admin cannot create `scope: 'provincial'` or `municipalityId` ≠ own)
   - Validates vertex cap, closure, bbox inside municipality boundary (for muni admin)
   - Douglas-Peucker normalization (canonical form)
   - Computes bbox + geohash prefix
   - Writes `hazard_zones/{newZoneId}` + `history/v1` atomically in a single Firestore transaction (prevents race where two parallel creates could collide on the same zoneId)
   - Streams audit event
6. `onWrite` trigger fires `hazardZoneSweep` (see 4.4).

**All custom zone mutations (create/update/delete) use Firestore transactions** that atomically read the current zone state, verify the expected version, and write both the zone update and the `history/{version}` snapshot in one commit. This prevents the race where two parallel callables both read version N and silently overwrite each other's `history/v(N+1)`. The second writer's transaction retries, reads version N+1, and fails with a structured CONFLICT error that the UI surfaces.

### 4.3 Ingest auto-tag (inside `processInboxItem`)

Hot path. Runs on every inbox event.

1. Inbox trigger fires on `report_inbox/{id}`.
2. Existing triptych materialization runs inside its transaction. During this transaction, `processInboxItem` also writes `locationGeohash` (6-char geohash of exact GPS location) to `report_ops` — this is a field addition to the existing `report_ops` write, not a new transaction.
3. **After the triptych transaction commits, a follow-up auto-tag step runs:**
   - If `locationPrecision === 'gps'`:
     - Compute the report's 4-char geohash prefix AND its 8 neighboring 4-char prefixes (via `ngeohash.neighbors()`) to handle boundary-straddling — a point on a cell edge may fall inside a zone indexed in the adjacent cell
     - Query `hazard_zones` where `geohashPrefix` starts with any of these 9 prefixes, `deletedAt == null`, `supersededBy == null`, `expiredAt == null` → candidates (typically 1–20; worst case ~50 with neighbors, still fast)
     - Turf.js `booleanPointInPolygon` on each candidate
     - Build `HazardTag[]` from matches
   - Update `report_ops` with `hazardZoneIds: HazardTag[]` + `hazardZoneIdList: string[]`
   - If `locationPrecision === 'barangay_only'`: skip auto-tag; `requiresLocationFollowUp: true`; no dead-letter (not an error).
4. Budget: 10–20ms p50, 30–50ms p99. Fits within p95 < 3s ingest SLO.

**Why NOT inside the triptych transaction:** Adding a `hazard_zones` query to the triptych transaction expands its read set. If any matched zone is edited between the read and the commit, the transaction retries. During a surge + simultaneous zone edit, this creates a retry storm on the hot path. Separating auto-tag into a follow-up write means: the report always materializes (life-safety-critical), and tagging is best-effort with a safety net.

**Failure handling:** If the follow-up auto-tag step fails (query error, timeout, CF crash), the report exists untagged. `processInboxItem` appends a `dead_letters/{id}` entry with `category: 'hazard_tag_failed'`. No citizen report is degraded by an auto-tag failure. Recovery has two paths:

1. **`hazardTagBackfillSweep`** (scheduled, every 5 minutes) — queries `report_ops` where `locationGeohash IS NOT NULL` AND `hazardZoneIds` is empty/null AND `createdAt > now - 90d`. For each match, runs the same geohash-prefix → Turf.js pipeline and tags. This is the **primary** recovery path; it catches untagged reports regardless of whether any zone is later edited. Same pattern as `inboxReconciliationSweep` in Architecture §10.2 — periodic backfill as safety net, not event-triggered-only.
2. **`hazardZoneSweep`** — catches reports when a zone is edited (already described in §4.4). This is a secondary path for re-tagging, not the primary recovery for ingest failures.
3. **Manual ops replay callable** — available for targeted recovery of specific reports.

### 4.4 Custom zone sweep

Triggered by `onWrite hazard_zones/{zoneId}` where `zoneType === 'custom'`.

1. Read old and new zone state from change event.
2. Compute bbox union (old ∪ new).
3. Query `report_ops` where:
   - `createdAt >= now() - 90 days` (older archived per §11.2)
   - `locationGeohash` prefix intersects bbox union (uses the denormalized geohash field from §2.2 — avoids reading `report_private`)
4. For each candidate:
   - Point-in-polygon against NEW geometry (or empty if deleted)
   - Delta computation:
     - In old but not new → remove tag (or keep, depending on trigger kind — see below)
     - In new but not old → append tag with `taggedBy: 'zone_sweep'`
     - In both → no-op (tag already present)
5. Apply delta atomically per `report_ops`.
6. Idempotency: `hazard_sweep_{zoneId}_v{version}` in `idempotency_keys`.

**Deletion vs expiration asymmetry:**
- `deleteCustomHazardZone` (soft delete): sweep REMOVES tags from active reports. Deletion means "this zone should not have been in effect."
- `hazardZoneExpirationSweep` (time-based): sets `expiredAt` but does NOT remove tags. Expiration is lifecycle; history preserved for analytics.

**Bound on sweep work:** Custom zone bbox capped ~100km²; at ~500 active reports/muni, scans dozens of candidates. Latency ~2–5s, async, not on hot path.

### 4.5 Polygon-targeted mass alert

Extends §3 / §7.5.1 workflow.

1. Admin opens Send Mass Alert → selects target type "Polygon" (alongside Municipality / Barangay).
2. Admin picks existing zone from own-jurisdiction list OR draws ad-hoc polygon.
3. Admin enters message.
4. Client calls `massAlertReachPlanPreview` with `targetType: 'polygon'` + geometry.
5. Callable:
   - Reverse-geocodes polygon to affected barangays (in-memory point-in-polygon over barangay boundary dataset, CF-cached)
   - Estimates recipients: registered users in affected barangays + opted-in msisdns + pseudonymous users with recent-known location inside
   - Computes routing per §3: ≤5k + single-muni → direct; else → escalation
   - Returns Reach Plan (breakdown, routing decision, preview)
6. Admin reviews Reach Plan → confirms.
7. Client calls `sendMassAlert` (direct) or `requestMassAlertEscalation` (escalation) with polygon attached.
8. Direct path: `sendMassAlert` server-side validates thresholds (defense in depth), writes `alerts/{id}` with polygon, fans out FCM + SMS, streams audit with polygon geometry.
9. Escalation path: `mass_alert_requests/{id}.targetGeometry` set; Superadmin forwards via existing `forwardMassAlertToNDRRMC`.

**Why reverse-geocode to barangay, not direct GPS match against users?** Citizen locations mostly stale (no continuous polling for privacy + battery); registered citizen addresses are at barangay granularity by design. Polygon precision becomes a filter refinement ON TOP of barangay routing: "send to registered users in affected barangays whose most recent known location is inside polygon," falling back to barangay-level when no recent location.

**De minimis boundary intersection handling.** Philippine LGU boundary data has known gaps and overlaps. A polygon that clips 50 meters into a neighboring municipality due to GIS data quality should not force NDRRMC escalation when the alert is operationally single-municipality. The routing rule is:

- Compute polygon-municipality intersection area for each municipality the polygon touches.
- The **primary municipality** is the one with the largest intersection area.
- A secondary municipality is **de minimis** if BOTH: (a) its intersection area is < `system_config/polygon_alert_thresholds.deMinimisAreaPct` (default: 5%) of total polygon area, AND (b) estimated recipients in the clipped area < `system_config/polygon_alert_thresholds.deMinimisRecipientCount` (default: 50).
- If ALL secondary municipalities are de minimis → treat as single-municipality (primary). Recipients in clipped areas are still included in the alert.
- If ANY secondary municipality exceeds the de minimis threshold → multi-municipality routing applies (escalation per §3).
- The Reach Plan preview shows the intersection breakdown so the admin sees exactly which munis are involved and whether de minimis applies.
- Both thresholds are in `system_config` and adjustable without redeploy.

### 4.6 Analytics queries

Analytics live in BigQuery. Callable wrappers for the admin dashboard:

| Callable | Returns |
|---|---|
| `hazardAnalyticsZoneTagCounts` | Per-zone count of tagged reports in a time window, filterable by severity |
| `hazardAnalyticsMunicipalityRiskDensity` | Per-barangay incident count / area, intersected with hazard zones, normalized by population (if dataset loaded) |
| `hazardAnalyticsReportsInZone` | List of report IDs tagged with a given zone (no PII), for drill-down |

Each is rate-limited and jurisdiction-scoped server-side:
- Muni admin: `WHERE municipality_id = <own>`
- Superadmin: unrestricted

Callables run BigQuery queries via function service account. Client never talks to BigQuery directly. Target: p95 < 3s over 30-day window at ~50k reports × 5k zones. Materialized views pre-aggregate if p95 drifts.

### 4.7 Expiration handling

`hazardZoneExpirationSweep` runs hourly:
- Query `hazard_zones` where `zoneType === 'custom'`, `expiresAt <= now()`, `expiredAt == null`
- Set `expiredAt: now()`, append history entry `{action: 'expired'}`
- Does NOT trigger `hazardZoneSweep`. Tags preserved.
- Streams audit (batch path — automatic action).

Admin map clients filter live overlay by `expiredAt == null`. Analytics dashboard can show expired zones for historical context.

---

## 5. UI & Role Capability Additions

Capability-level only. Pixel-level UX deferred to `frontend-design` pass.

### 5.1 Municipal Admin — `municipal-admin-role-spec-v2.1`

**§2.1 "What Municipal Admins CAN Do" — add rows:**

| Action | Scope | Callable / Write |
|---|---|---|
| View hazard reference overlays (flood, landslide, storm surge) | Province-wide reference data | Firestore listener filtered by `zoneType == 'reference'` |
| View own-muni custom hazard zones | Own municipality | Firestore listener filtered by `municipalityId == own` |
| Author own-muni custom zones | Own municipality | `createCustomHazardZone` callable |
| Edit any own-muni custom zone | Own municipality (any author) | `updateCustomHazardZone` callable |
| Delete any own-muni custom zone | Own municipality (any author) | `deleteCustomHazardZone` callable |
| View auto-tagged hazard zones on reports | Own municipality reports | `report_ops.hazardZoneIdList` on existing listener |
| Send polygon-targeted mass alerts | Own muni polygons (≤5k direct, else escalate) | Extended `massAlertReachPlanPreview` / `sendMassAlert` / `requestMassAlertEscalation` |
| View muni hazard analytics | Own municipality only | `hazardAnalytics*` callables |

**§2.2 "What Municipal Admins CANNOT Do" — add rows:**

| Action | Why |
|---|---|
| Upload hazard reference layers | Superadmin-only (data provenance + version control) |
| Edit provincial-scope custom zones | Out of jurisdiction |
| View other munis' custom zones | Jurisdiction boundary |
| Author custom zones outside own municipality | Rule-enforced bbox check |
| Edit or delete provincial-scope custom zones (Superadmin-created) | Out of jurisdiction — provincial zones are not scoped to any single municipality |

**New §4.X "Hazard Overlay & Custom Zones":**
- Map layer panel (toggleable): 3 reference-layer checkboxes, severity-coded fills, low opacity.
- Custom zone panel: own-muni active zones (not-expired, not-deleted). Row: purpose, severity, time-to-expiry, tagged-report count.
- "Draw new zone" affordance: `hazardType` / `purpose` / `severity` / `expiresAt` selection; Leaflet-Draw polygon; client-side vertex + bbox validation.
- Zone editor for any own-muni custom zone (regardless of who authored it — Principle #11: authorization by data-class reach, not authorship): inline geometry edit, update `expiresAt` / `purposeDescription` / `severity`. Cannot change `hazardType` or `scope`.
- Auto-tag visibility in triage queue: reports with `hazardZoneIdList.length > 0` show colored hazard badge; tooltip expands to zone list.
- Queue filter: "Show only reports inside hazard zones" + per-zone filter.

**New §6.2 "Polygon-Targeted Mass Alerts":**
- Target selector gains "Polygon" (alongside Municipality / Barangay).
- Polygon target: pick existing zone OR draw ad-hoc.
- Reach Plan shows barangay-level recipient breakdown.
- Confirmation copy distinguishes direct send vs escalation (same as existing).

**§8 "Analytics & Reporting" — add hazard correlation widget:**
- Top 3 hazard zones by tagged-report count (last 30 days)
- Per-hazard-type incident distribution as stacked bars
- Per-barangay risk density heatmap overlay
- Drill-down to `hazardAnalyticsReportsInZone`

### 5.2 Provincial Superadmin — `provincial-superadmin-role-spec-v2.1`

**§3 "Permissions & Access" — add rows:**

| Action | Scope | Callable / Write |
|---|---|---|
| Upload hazard reference layers | Province-wide | `uploadHazardReferenceLayer` |
| Supersede reference layers | Province-wide | `supersedeHazardReferenceLayer` |
| Author province-wide custom zones | Province-wide | `createCustomHazardZone` with `scope: 'provincial'` |
| Author any muni's custom zones | Any municipality | `createCustomHazardZone` with any `municipalityId` |
| Edit / delete any custom zone | Any authorship | `updateCustomHazardZone` / `deleteCustomHazardZone` |
| View all hazard zones | Province-wide | Firestore listener (unrestricted) |
| View province-wide hazard analytics | Province-wide | Same analytics callables, unrestricted scope |

**New §2.X "Hazard Mapping Surface":**

Fits the dual-monitor layout:
- **Primary (Analytics Dashboard)** gains hazard analytics panel:
  - Province-wide "reports in hazard zones last 30d" by muni (BigQuery-backed — analytics-grade, eventual consistency OK)
  - Reference layer version status: active per `hazardType`, last upload, uploader (**reads from Firestore `hazard_zones` directly**, not BigQuery — must reflect real-time state immediately after upload/supersede, not lag 5 min behind)
  - Custom zone activity: active count, expiring-within-24h, recently-created (**reads from Firestore** for same reason)
- **Secondary (Provincial Map)** gains:
  - All 3 reference layer toggles
  - Custom zone list (all munis, filterable)
  - Reference layer management panel: upload, inspect, supersede

**New §X "Hazard Reference Layer Management":**
- Upload workflow per §4.1. TOTP re-prompt required.
- Upload result view: zones created, vertices before/after, rejected features with reasons.
- Supersede workflow: select old version → pick already-uploaded new version → confirm.
- Version history: every version listed with uploader, date, source agency, source version. Cannot delete — only supersede.

**New §X "Province-Wide Custom Zones":**
- Same drawing as muni admin + `scope: 'provincial'` option.
- Provincial zones invisible to muni admins (§3.1 rule).
- CF trigger on `hazard_zones` create with `scope === 'provincial'` auto-attaches a Command Channel thread with every affected muni admin.

**§5 "NDRRMC Escalation Workflow" extension:**
- Polygon-targeted mass alerts feed into existing escalation path.
- `mass_alert_requests/{id}.targetGeometry` carries polygon; forward-to-NDRRMC workflow passes it through.
- Reach Plan preview uses §4.5 polygon-to-barangay reverse-geocode.

**§9 "System Operations" additions:**
- Hazard BigQuery mirror lag indicator (<5min; alert if >15min)
- Hazard zone sweep backlog indicator
- Auto-tag failure rate (from `dead_letters` filtered on `hazard_tag_failed`)

### 5.3 Non-hazard roles — explicit denial rows

**`citizen-role-spec-v2.1` §2.2:**

| Action | Why |
|---|---|
| View hazard zones or overlays | Admin-operational data; hazard maps would reveal response posture and operational info |

**`responder-role-spec-v2.1` §2.2:**

| Action | Why |
|---|---|
| View hazard zones or overlays | LGU/agency coordination function; responder app is dispatch-execution-focused |

**`agency-admin-role-spec-v2.1` §2.2:**

| Action | Why |
|---|---|
| View hazard zones, reference layers, or custom zones | Hazard mapping is LGU (municipal + provincial) jurisdiction, matching §2.1 principle that verification + triage tools are LGU-scoped |

Pure additions — no existing capability removed.

### 5.4 Shared Admin Desktop additions

- New nav tab: **Hazard Layers** (between Reports and Analytics, subject to `frontend-design` IA pass)
- Global layer-toggle control on main map (persisted via `users/{uid}/preferences`)
- Status-bar indicator: if any active zone intersects viewport → count + hazard type summary
- Client-derived `canHazardAuthor: boolean` from role + jurisdiction, controls "Draw new zone" visibility

**Agency Admin view unchanged.** No Hazard Layers tab, no layer-toggle, no analytics. Rule-enforced + UI-enforced defense in depth.

### 5.5 Consistency notes (baked in, not new decisions)

- Custom zone edit UI matches existing report-edit patterns (modal-over-map; §3.1 muni admin principle: "Map is permanent background")
- Reference layer rendering uses existing Leaflet tile layer pattern
- Hazard mutation audit entries appear in existing audit viewer (Superadmin §8)
- Hazard badges on reports match existing badge system (`witnessPriorityFlag`, `Responder-Witnessed`)

---

## 6. Architecture Spec v7.1 Amendment Manifest

Integration checklist for the spec author.

### 6.1 New primary section: §22 "Geoanalytics & Hazard Mapping"

Placement: after §21. Length estimate: ~150–200 lines.

Content outline:
- Feature overview (§1-style framing)
- Hazard taxonomy (flood / landslide / storm surge; seismic deferred rationale)
- Data sources & update cadence (PAGASA / MGB; manual Superadmin upload; yearly-to-decadal)
- Storage architecture (hybrid: Cloud Storage + Firestore + BigQuery)
- Schemas (cross-reference to this design doc §2)
- Lifecycle model (reference immutable-versioned; custom event-bounded; expiration vs deletion asymmetry)
- Functional flows (summary of §4)
- Rules + callables (cross-reference to §5.7, §10.1)
- Integration points (ingest, mass-alert thresholds, audit, BigQuery mirror)

### 6.2 Decision log additions (§18)

| # | Decision | Rationale | Rejected Alt | Residual |
|---|---|---|---|---|
| 46 | Hazard zones admin-only (muni + superadmin) | Citizen exposure leaks operational info; matches v7 principle #11 | Citizen-visible reference layer | Citizens don't see known risk passively; reached via mass alert |
| 47 | Reference layers immutable + versioned; custom zones mutable + event-bounded | Historical audit integrity vs operational flexibility | Single mutable model | More state classes; explicit version bumps in audit |
| 48 | Hybrid spatial storage (Cloud Storage + Firestore + BigQuery) | Auto-tag can't afford Cloud Storage or BigQuery per event; analytics can't afford client-side scan | Single-store | Three layers to keep coherent |
| 49 | Auto-tag forward-only for reference; sweep for custom; tags survive expiration; tags purged on deletion | Reference = frozen risk profile; custom = current operational; expiration is lifecycle; deletion is retraction | Always-sweep or never-sweep | Asymmetry must be explicit in docs |
| 50 | Muni admin reads reference layers (all) + own-muni custom zones only | Reference is public-ish; custom is operational; Superadmin uses Command Channel for cross-muni coordination | Read all provincial-scope zones | Superadmin must explicitly loop munis |
| 51 | Polygon-targeted mass alerts reuse §3 thresholds unchanged | Polygon is new geometry, not new channel | Relax thresholds for polygon | No change to existing mass-alert behavior |

### 6.3 SLO additions (§13.2)

| Metric | Target | Window |
|---|---|---|
| Hazard auto-tag latency (in `processInboxItem`) | p95 < 30ms | rolling 5min |
| Hazard zone sweep completion | p95 < 10s | rolling 1h |
| Hazard BigQuery mirror lag | < 5min | continuous |
| Hazard analytics dashboard query | p95 < 3s | rolling 1h |
| Polygon Reach Plan estimation | p95 < 2s | rolling 1h |
| Auto-tag failure rate | < 0.1% of ingest events | rolling 1h |

### 6.4 Risk register additions (§15)

| Risk | Residual Reality | Mitigation |
|---|---|---|
| Hazard auto-tag silently drops on ingest failure | Untagged reports; admins miss correlation | Dead-letter entry; ops replay callable; next zone edit sweeps it in |
| Custom zone edit at 2 AM creates bad geometry | Wrong-jurisdiction / over-large / wrong-severity zones | Server-side vertex cap + bbox-in-muni check; history for rollback |
| Reference upload malformed GeoJSON DOSes CF | Memory exhaustion, cold-start failure | Signed URL size cap; schema validation before simplification; per-feature timeout |
| Polygon mass alert routes wrong | Message to wrong audience | Server-side threshold check (defense in depth); polygon-to-barangay validated against jurisdictions; streaming audit |
| Superseded reference queried after supersede | Auto-tag or sweep matches old | Query filter `supersededBy == null && deletedAt == null`; composite index |
| BigQuery mirror drift masks incorrect analytics | Stale / wrong dashboard numbers | Mirror-lag SLO alert; freshness indicator on dashboard |
| Event-bounded zone never expires (sweep bug) | Zone stays "active" forever | Client-side fallback filter on `expiresAt < now()`; monitoring alert |
| Barangay boundary dataset goes stale | Wrong-barangay reverse-geocode | Dataset version pinned per CF deploy; yearly minimum update cadence |
| Two admins edit same zone simultaneously | One edit overwrites other | Optimistic version check inside a Firestore transaction that atomically reads `hazard_zones/{id}`, verifies `version === expectedVersion`, writes the updated zone AND `history/{version}` snapshot in one commit. Second writer's transaction retries, reads the new version, and fails with CONFLICT. No silent history overwrite. |
| Admin creates zone with past `expiresAt` | Expires immediately, never visible | Server-side `expiresAt > now() + 5min`; max 30d out |
| Large custom zone triggers runaway sweep | CF memory/timeout | Bbox area cap ~100km² |

### 6.5 Pilot-blocker test scenarios (§14) — additions 25–40

25. Superadmin uploads PAGASA 2024 flood map (50 polygons) → simplified to ≤500 vertices each → visible on Daet muni admin map within 30s.
26. Flood v2024 superseded by v2025 → superseded zones retain tag attribution on existing reports → new reports tag against v2025 only.
27. Muni admin draws 12-vertex evac polygon → sweep tags 47 existing reports within 10s.
28. Muni admin edits zone (shrinks) → reports in old-but-not-new lose tag; reports in new-but-not-old gain tag; history preserved.
29. Muni admin deletes custom zone → tags removed; deletion streams to audit.
30. Event-bounded zone reaches `expiresAt` → sweep sets `expiredAt` → client stops rendering → tags on existing reports PRESERVED.
31. Muni admin attempts `createCustomHazardZone` with `municipalityId` ≠ own → `PERMISSION_DENIED`.
32. Agency admin attempts `hazard_zones` read → `PERMISSION_DENIED`.
33. Citizen attempts `hazard_zones` read → `PERMISSION_DENIED`.
34. Report ingested with GPS inside 2 overlapping zones → tagged with BOTH.
35. Report ingested `barangay_only` → auto-tag skipped; `requiresLocationFollowUp: true`; no dead-letter.
36. Polygon mass alert, 3,000 recipients single muni → direct-send path; streams with polygon geometry.
37. Polygon mass alert, 8,000 recipients single muni → escalates to NDRRMC; direct-send refused.
38. Polygon mass alert spanning 2 munis → escalates regardless of count.
39. Analytics query "reports in flood zone last 30d" → p95 < 3s; correct count vs BigQuery ground truth.
40. Auto-tag failure (simulated) → report materialized untagged; `dead_letters/hazard_tag_failed`; ops replay re-tags within 1h.

### 6.6 Pilot acceptance criteria (§20) — additions 26–33

26. Reference upload-simplify-persist round-trip on real PAGASA + MGB data, simplification preserves ≥95% geometric fidelity (IoU).
27. Custom zone sweep on typical-size edit (<100km²) completes <10s and correctly re-tags ≥99%.
28. Auto-tag accuracy: manually-verified in/out → 100% on sample of 100 reports.
29. Polygon mass alert Reach Plan within ±10% of actual delivery count.
30. Hazard analytics dashboard usable by non-GIS muni admin with <10 min training.
31. Expiration sweep correctness: zero zones stuck past `expiresAt` over 30-day measurement.
32. BigQuery mirror freshness: lag <5 min p95, <15 min p99, 30-day measurement.
33. Zero auto-tag failures escape dead-letter replay within 1h at p95.

### 6.7 Open risks for pilot to validate (§16) — additions 16–20

16. Real-world polygon complexity from PH government maps — ≤500-vertex cap edge cases? May need bump to 1000.
17. Custom zone authorship rate during active typhoon — does 50/day pinch muni admins in rapid-evolving evacs?
18. Auto-tag latency under surge — 10–20ms budget when `processInboxItem` at minInstances-3?
19. Barangay boundary accuracy in rural Camarines Norte (informal boundaries) — reverse-geocode miss rate?
20. Admin drawing UX on tablet in field — Leaflet-Draw on touch + small screen precision unproven.

### 6.8 Monitoring & alerting additions (§13.7)

| Signal | Threshold | Owner |
|---|---|---|
| Hazard auto-tag failure rate | > 0.1% over 1h | Backend on-call |
| Hazard tag backfill backlog | > 5 untagged reports older than 5 min | Backend on-call |
| Hazard zone sweep backlog | > 10 pending | Backend on-call |
| Hazard BigQuery mirror lag | > 5min | Backend → Compliance if persistent |
| Expiration sweep error rate | > 0 errors / hour | Backend on-call |
| Custom zone authorship anomaly | > 2× 7-day baseline | Ops |

### 6.9 Observability dashboards (§13.9) additions

**Ops:** Hazard sweep queue depth; auto-tag success rate by muni.
**Backend:** Hazard callable invocations / errors / p95; auto-tag latency contribution to `processInboxItem` overall.
**Compliance:** Reference layer upload history; custom zone deletion log.

### 6.10 Capability contract tests (Principle #11 enforcement)

- Every new UI affordance maps to a rule-enforced callable or Firestore read.
- CI test: no muni-admin UI attempts to call `uploadHazardReferenceLayer`.
- CI test: no citizen / responder / agency UI imports hazard-layer component bundle (build-time static check).

### 6.11 Composite index additions (§5.9) — already listed in §2.5 of this doc

### 6.12 §21 "What This Spec Is Not" additions

- Not a hazard modeling spec (risk scoring beyond tag counts deferred to v8)
- Not a PAGASA/MGB integration spec (no automated pipelines)
- Not a prediction/simulation spec (typhoon tracks are PAGASA/NDRRMC's job)

---

## 7. Open Questions / Dependencies Flagged for Plan

These are not design ambiguities — they're dependencies that the implementation plan must address explicitly:

1. **Barangay boundary dataset.** Reverse-geocoding polygons to barangays (§4.5) requires a barangay boundary GeoJSON for the 12 Camarines Norte munis. This does not exist in the current architecture. Plan must include sourcing + versioning this dataset.
2. **Leaflet-Draw dependency.** Adds ~40KB gzipped to the admin bundle. Confirm acceptable against existing admin bundle budget (no explicit admin PWA bundle budget in v7, but worth measuring).
3. **BigQuery GIS availability.** `GEOGRAPHY` type + `ST_Contains` are standard BigQuery features but confirm they're enabled in `bantayog-prod` project.
4. **Douglas-Peucker library choice.** `@turf/simplify` is the natural pick (already in the Turf.js ecosystem used for point-in-polygon). Plan should specify exact dependency.
5. **Geohash library.** `ngeohash` or `@terraformer/wkt` for 6-char geohash encoding in CF + client. Plan should specify.
6. **PAGASA + MGB data licensing.** Superadmin obtains GeoJSON via official channels. Attribution requirements must be captured in the upload manifest and displayed in audit. Not a blocker for this design but flagged for implementation.

---

## 8. Success Criteria for This Design Doc

This design doc is done when:
- All structural decisions (A/B/C/D choices) are recorded in §0 with rationale traceable
- `writing-plans` can produce an implementation plan from this doc alone, without re-asking design questions
- No section contains "TBD", "TODO", or "pending decision"
- Every new capability maps to an explicit callable + rule + audit path
- The reader can locate any referenced field, flow, or decision within this doc or via cross-reference to Architecture Spec v7

---

**End of Hazard/Geoanalytics Design Spec v1.0**
