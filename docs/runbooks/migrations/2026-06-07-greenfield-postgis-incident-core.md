# Greenfield PostGIS Incident Core Migration Plan

Status: Stage 1 SQL artifacts now exist under `infra/postgres/`. No Terraform
resource, Cloud SQL apply, staging deploy, production deploy, or Firebase deploy
has been run.

## Scope

This plan is the Stage 1 migration document for the greenfield rebuild from the
current Firebase/Firestore operational model toward Cloud Run plus Cloud SQL
PostgreSQL/PostGIS as the incident and geospatial system of record.

The target design keeps Firebase Auth, FCM, Storage, and Hosting as operational
glue, but moves incident lifecycle records, spatial queries, and public map read
models into Postgres/PostGIS.

## Old Schema

Current production data is Firestore/RTDB-centered:

- `reports` stores public/ops report state, public location, visibility, media
  refs, source, and lifecycle status.
- `report_private`, `report_contacts`, and `secret_lookup` store private
  reporter and tracking data.
- `report_ops`, `report_events`, `dispatch_events`, `report_notes`, and
  `dispatches` provide operational views and lifecycle history.
- `alerts`, `situation_updates`, `responders`, RTDB `responder_locations`, and
  RTDB `shared_projection` support map, alert, and responder presence flows.

Relevant current contracts live in:

- `packages/shared-validators/src/reports.ts`
- `packages/shared-validators/src/dispatches.ts`
- `packages/shared-validators/src/responders.ts`
- `packages/shared-validators/src/incident-core.ts`

## New Schema

The first executable SQL migration should create a new schema namespace, enable
PostGIS, and keep all tables default-deny until policies are deliberately added.

Proposed namespace and extensions:

```sql
create extension if not exists postgis;

create schema if not exists incident_core;
```

Core tables:

```sql
create table incident_core.incidents (
  id uuid primary key,
  report_type text not null,
  severity text not null,
  operational_status text not null,
  verification_status text not null,
  publication_status text not null,
  municipality_id text not null,
  municipality_label text not null,
  barangay_id text not null,
  source text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.reports (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id),
  reporter_role text not null,
  description text not null,
  submitted_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.incident_verifications (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id),
  state text not null,
  reviewed_by_uid text,
  reviewed_at timestamptz,
  reason text,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.dispatches (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id),
  responder_uid text not null,
  agency_id text not null,
  status text not null,
  dispatched_by_uid text not null,
  dispatched_at timestamptz not null,
  status_updated_at timestamptz not null,
  idempotency_key text not null,
  schema_version integer not null check (schema_version > 0),
  unique (incident_id, idempotency_key)
);
```

Privacy, audit, and public read-model tables:

```sql
create table incident_core.reporter_privacy_records (
  incident_id uuid primary key references incident_core.incidents(id),
  reporter_uid text not null,
  reporter_phone_hash text,
  retention_state text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0),
  check (reporter_phone_hash is null or reporter_phone_hash ~ '^[a-f0-9]{64}$')
);

create table incident_core.audit_events (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id),
  actor_uid text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.public_incident_cards (
  incident_id uuid primary key references incident_core.incidents(id),
  report_type text not null,
  severity text not null,
  operational_status text not null,
  municipality_id text not null,
  municipality_label text not null,
  barangay_id text not null,
  public_summary text not null,
  point geography(point, 4326) not null,
  published_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);
```

PostGIS tables:

```sql
create table incident_core.incident_locations (
  incident_id uuid primary key references incident_core.incidents(id),
  point geography(point, 4326) not null,
  accuracy_meters numeric,
  source text not null,
  recorded_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.responder_locations (
  responder_uid text primary key,
  municipality_id text not null,
  point geography(point, 4326) not null,
  status text not null,
  captured_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.municipal_boundaries (
  municipality_id text primary key,
  name text not null,
  geom geometry(multipolygon, 4326) not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.alert_areas (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id),
  geom geometry(multipolygon, 4326) not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.duplicate_cluster_inputs (
  incident_id uuid primary key references incident_core.incidents(id),
  point geography(point, 4326) not null,
  report_type text not null,
  created_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);
```

Indexes:

```sql
create index incident_locations_point_gist
  on incident_core.incident_locations using gist (point);

create index responder_locations_point_gist
  on incident_core.responder_locations using gist (point);

create index municipal_boundaries_geom_gist
  on incident_core.municipal_boundaries using gist (geom);

create index alert_areas_geom_gist
  on incident_core.alert_areas using gist (geom);

create index public_incident_cards_point_gist
  on incident_core.public_incident_cards using gist (point);

create index public_incident_cards_updated_at_idx
  on incident_core.public_incident_cards (updated_at desc);
```

## RLS Model

All target tables should enable and force RLS in the first migration:

```sql
alter table incident_core.incidents enable row level security;
alter table incident_core.incidents force row level security;
```

Repeat for every `incident_core.*` table. Do not grant table privileges to app
roles until policies are in the same migration or an immediately paired
migration.

Required roles:

- `bantayog_public_read`: read only `public_incident_cards` and public alert
  projections.
- `bantayog_ops_read`: read operational tables scoped by municipality and role.
- `bantayog_ops_write`: execute command transactions through Cloud Run only.
- `bantayog_worker`: project public read models, write audit events, and run
  async jobs.

The public role must never receive privileges on privacy, report contacts,
reporter identity, operational dispatch internals, or audit metadata tables.

## Query Proofs

The next test harness should prove these before production migration:

- Public bbox map read:
  `ST_Intersects(point::geometry, ST_MakeEnvelope(..., 4326))` against only
  `public_incident_cards`.
- Nearby responder ranking:
  `ST_DWithin(responder.point, incident.point, radius_meters)` with distance in
  meters and a stable order by `ST_Distance`.
- Municipality containment:
  `ST_Contains(municipal_boundaries.geom, incident_locations.point::geometry)`.
- Duplicate clustering:
  candidate selection with `ST_DWithin`, followed by deterministic clustering
  using a stable order around `ST_ClusterDBSCAN`.
- Publication transaction:
  incident publication changes insert/update `public_incident_cards`; unpublish
  removes or tombstones the public card in the same transaction.

## Trigger Compatibility Matrix

| Current function surface                        | Greenfield command/read group          | Compatibility requirement                                                                          |
| ----------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `submitCitizenReport`                           | `reports.submit`                       | Creates incident, report, location, privacy record, audit event.                                   |
| `verifyReport`, `rejectReport`                  | `incidents.verify`, `incidents.reject` | Updates verification axis without overloading operational status.                                  |
| `dispatchResponder`, responder status callables | `dispatches.*`                         | Dispatch rows reference `incident_id`; responder status is append-only or latest-state plus audit. |
| `declareAlert`, alert subscriptions             | `alerts.*`                             | Alert areas use PostGIS geometry; public reads use sanitized projection.                           |
| erasure callables                               | `privacy.*`                            | Privacy rows stay separate from public projections and support erasure/legal hold states.          |
| ops metrics/map/feed callables                  | `ops.*` and `/read/ops/*`              | Reads are municipality-scoped and versioned for SSE resync.                                        |
| Citizen map/feed reads                          | `/public/incidents`                    | Reads only `public_incident_cards`, never operational/private tables.                              |

## Backfill Strategy

This is a greenfield rebuild, so the first production cut should avoid live
Firestore-to-Postgres backfill unless a migration window is explicitly opened.
If parity migration is required:

1. Export current Firestore reports, private records, dispatches, alerts, and
   responder state into a staging dataset.
2. Transform into the `incident_core.*` shape offline.
3. Load into a staging Cloud SQL instance.
4. Run query/RLS acceptance tests against staging.
5. Freeze writes only for the final cutover window, then replay delta events.

## Rollback Plan

No rollback command is executable until a concrete migration file exists. The
first executable SQL migration must include:

- A down migration or explicitly documented irreversible sections.
- The exact Cloud SQL migration runner command for staging.
- A reverse projection plan for public cards.
- A requirement that production SQL/RLS changes soak in staging overnight before
  production.

Do not deploy a production SQL/RLS migration in the same session it is authored.

## Monitoring Signals

Minimum signals before staging cutover:

- Public bbox query p95 latency.
- Nearby responder query p95 latency.
- Publish/unpublish transaction latency.
- Public projection row count vs published incident count.
- RLS denial counts grouped by role.
- Audit event write success rate.
- Privacy erasure/legal-hold transition counts.

## Applied Stage 1 Diff

After approval of this plan, the first executable migration diff added:

- `infra/postgres/migrations/001_incident_core.sql`
- `infra/postgres/migrations/001_incident_core.down.sql`
- `infra/postgres/tests/incident-core.sql`
- a local test runner documented in `infra/postgres/README.md`

Future schema/RLS changes must still be shown in full before they are applied.

## Sources

- PostGIS `ST_DWithin`: https://postgis.net/docs/ST_DWithin.html
- PostGIS spatial indexes: https://postgis.net/documentation/faq/spatial-indexes/
- Cloud SQL PostgreSQL extensions: https://docs.cloud.google.com/sql/docs/postgres/extensions
- PostgreSQL row security policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
