# Bantayog Postgres/PostGIS Migrations

These files are for the greenfield Cloud Run + Cloud SQL PostgreSQL/PostGIS
incident core. They are not applied by Firebase deploys.

## Local Verification

Run against a disposable PostgreSQL database with PostGIS installed:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/migrations/001_incident_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/tests/incident-core.sql
```

Rollback in the disposable database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/migrations/001_incident_core.down.sql
```

## Deployment Rules

- Do not apply SQL to staging or production without a fresh human approval.
- Do not apply production SQL/RLS changes in the same session they were authored.
- Soak all schema and RLS changes in staging overnight before production.
- Keep Firebase Auth/FCM/Storage/Hosting as operational glue; Cloud SQL becomes
  the greenfield incident and geospatial system of record only after API cutover.

## Current Migration

`001_incident_core.sql` creates:

- `incident_core` schema.
- PostGIS extension.
- incident, report, verification, dispatch, responder status, alert, privacy,
  audit, and public-read-model tables, including sanitized public incident and
  alert projections.
- PostGIS geography/geometry columns and GiST indexes.
- default-deny RLS posture with explicit grants for scoped public, ops, and
  worker roles.
