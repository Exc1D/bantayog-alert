begin;

create extension if not exists postgis;

create schema if not exists incident_core;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bantayog_public_read') then
    create role bantayog_public_read nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'bantayog_ops_read') then
    create role bantayog_ops_read nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'bantayog_ops_write') then
    create role bantayog_ops_write nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'bantayog_worker') then
    create role bantayog_worker nologin;
  end if;
end;
$$;

create type incident_core.report_type as enum (
  'flood',
  'fire',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
  'medical',
  'accident',
  'structural',
  'security',
  'other'
);

create type incident_core.severity as enum ('low', 'medium', 'high');

create type incident_core.operational_status as enum (
  'intake',
  'triage',
  'ready_for_dispatch',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'cancelled',
  'merged_as_duplicate'
);

create type incident_core.verification_status as enum (
  'unverified',
  'awaiting_review',
  'verified',
  'rejected'
);

create type incident_core.publication_status as enum ('internal', 'public');
create type incident_core.incident_source as enum ('web', 'responder_witness', 'official');
create type incident_core.location_source as enum ('gps', 'manual', 'geocoder', 'responder_telemetry');
create type incident_core.dispatch_status as enum (
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
  'unable_to_complete',
  'needs_admin',
  'escalated'
);
create type incident_core.responder_status as enum (
  'available',
  'on_duty',
  'off_duty',
  'on_break',
  'unavailable',
  'active',
  'degraded',
  'stale',
  'offline'
);
create type incident_core.retention_state as enum (
  'active',
  'erasure_requested',
  'legal_hold',
  'erased'
);

create table incident_core.incidents (
  id uuid primary key,
  report_type incident_core.report_type not null,
  severity incident_core.severity not null,
  operational_status incident_core.operational_status not null,
  verification_status incident_core.verification_status not null,
  publication_status incident_core.publication_status not null,
  municipality_id text not null,
  municipality_label text not null,
  barangay_id text not null,
  source incident_core.incident_source not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.reports (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id) on delete restrict,
  reporter_role text not null check (reporter_role in ('citizen', 'responder')),
  description text not null check (char_length(description) <= 5000),
  submitted_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.incident_verifications (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id) on delete restrict,
  state incident_core.verification_status not null,
  reviewed_by_uid text,
  reviewed_at timestamptz,
  reason text,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.dispatches (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id) on delete restrict,
  responder_uid text not null,
  agency_id text not null,
  status incident_core.dispatch_status not null,
  dispatched_by_uid text not null,
  dispatched_at timestamptz not null,
  status_updated_at timestamptz not null,
  idempotency_key text not null,
  schema_version integer not null check (schema_version > 0),
  unique (incident_id, idempotency_key)
);

create table incident_core.responder_status_events (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id) on delete restrict,
  responder_uid text not null,
  status incident_core.responder_status not null,
  recorded_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.incident_locations (
  incident_id uuid primary key references incident_core.incidents(id) on delete restrict,
  point geography(point, 4326) not null,
  accuracy_meters numeric check (accuracy_meters is null or accuracy_meters >= 0),
  source incident_core.location_source not null,
  recorded_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.responder_locations (
  responder_uid text primary key,
  municipality_id text not null,
  point geography(point, 4326) not null,
  status incident_core.responder_status not null,
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
  incident_id uuid not null references incident_core.incidents(id) on delete restrict,
  municipality_id text not null,
  public_title text not null,
  public_summary text not null,
  geom geometry(multipolygon, 4326) not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.public_alert_cards (
  alert_id uuid primary key references incident_core.alert_areas(id) on delete restrict,
  municipality_id text not null,
  public_title text not null check (char_length(public_title) <= 200),
  public_summary text not null check (char_length(public_summary) <= 2000),
  geom geometry(multipolygon, 4326) not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  published_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.duplicate_cluster_inputs (
  incident_id uuid primary key references incident_core.incidents(id) on delete restrict,
  point geography(point, 4326) not null,
  report_type incident_core.report_type not null,
  created_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.reporter_privacy_records (
  incident_id uuid primary key references incident_core.incidents(id) on delete restrict,
  reporter_uid text not null,
  reporter_phone_hash text,
  retention_state incident_core.retention_state not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0),
  check (reporter_phone_hash is null or reporter_phone_hash ~ '^[a-f0-9]{64}$')
);

create table incident_core.audit_events (
  id uuid primary key,
  incident_id uuid not null references incident_core.incidents(id) on delete restrict,
  actor_uid text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create table incident_core.public_incident_cards (
  incident_id uuid primary key references incident_core.incidents(id) on delete restrict,
  report_type incident_core.report_type not null,
  severity incident_core.severity not null,
  operational_status incident_core.operational_status not null,
  municipality_id text not null,
  municipality_label text not null,
  barangay_id text not null,
  public_summary text not null check (char_length(public_summary) <= 2000),
  point geography(point, 4326) not null,
  published_at timestamptz not null,
  updated_at timestamptz not null,
  schema_version integer not null check (schema_version > 0)
);

create index incidents_municipality_updated_at_idx
  on incident_core.incidents (municipality_id, updated_at desc);
create index reports_incident_id_idx
  on incident_core.reports (incident_id);
create index incident_verifications_incident_id_idx
  on incident_core.incident_verifications (incident_id);
create index dispatches_incident_id_idx
  on incident_core.dispatches (incident_id);
create index responder_status_events_incident_id_idx
  on incident_core.responder_status_events (incident_id);
create index audit_events_incident_id_occurred_at_idx
  on incident_core.audit_events (incident_id, occurred_at desc);
create index incident_locations_point_gist
  on incident_core.incident_locations using gist (point);
create index responder_locations_point_gist
  on incident_core.responder_locations using gist (point);
create index responder_locations_municipality_updated_at_idx
  on incident_core.responder_locations (municipality_id, updated_at desc);
create index municipal_boundaries_geom_gist
  on incident_core.municipal_boundaries using gist (geom);
create index alert_areas_incident_id_idx
  on incident_core.alert_areas (incident_id);
create index alert_areas_municipality_starts_at_idx
  on incident_core.alert_areas (municipality_id, starts_at desc);
create index alert_areas_geom_gist
  on incident_core.alert_areas using gist (geom);
create index public_alert_cards_geom_gist
  on incident_core.public_alert_cards using gist (geom);
create index public_alert_cards_updated_at_idx
  on incident_core.public_alert_cards (updated_at desc);
create index public_alert_cards_municipality_updated_at_idx
  on incident_core.public_alert_cards (municipality_id, updated_at desc);
create index duplicate_cluster_inputs_point_gist
  on incident_core.duplicate_cluster_inputs using gist (point);
create index public_incident_cards_point_gist
  on incident_core.public_incident_cards using gist (point);
create index public_incident_cards_updated_at_idx
  on incident_core.public_incident_cards (updated_at desc);
create index public_incident_cards_municipality_updated_at_idx
  on incident_core.public_incident_cards (municipality_id, updated_at desc);

create function incident_core.current_municipality_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.municipality_id', true), '')
$$;

revoke all on function incident_core.current_municipality_id() from public;
grant execute on function incident_core.current_municipality_id()
  to bantayog_ops_read, bantayog_ops_write, bantayog_worker;

alter table incident_core.incidents enable row level security;
alter table incident_core.reports enable row level security;
alter table incident_core.incident_verifications enable row level security;
alter table incident_core.dispatches enable row level security;
alter table incident_core.responder_status_events enable row level security;
alter table incident_core.incident_locations enable row level security;
alter table incident_core.responder_locations enable row level security;
alter table incident_core.municipal_boundaries enable row level security;
alter table incident_core.alert_areas enable row level security;
alter table incident_core.public_alert_cards enable row level security;
alter table incident_core.duplicate_cluster_inputs enable row level security;
alter table incident_core.reporter_privacy_records enable row level security;
alter table incident_core.audit_events enable row level security;
alter table incident_core.public_incident_cards enable row level security;

alter table incident_core.incidents force row level security;
alter table incident_core.reports force row level security;
alter table incident_core.incident_verifications force row level security;
alter table incident_core.dispatches force row level security;
alter table incident_core.responder_status_events force row level security;
alter table incident_core.incident_locations force row level security;
alter table incident_core.responder_locations force row level security;
alter table incident_core.municipal_boundaries force row level security;
alter table incident_core.alert_areas force row level security;
alter table incident_core.public_alert_cards force row level security;
alter table incident_core.duplicate_cluster_inputs force row level security;
alter table incident_core.reporter_privacy_records force row level security;
alter table incident_core.audit_events force row level security;
alter table incident_core.public_incident_cards force row level security;

grant usage on schema incident_core to bantayog_public_read, bantayog_ops_read, bantayog_ops_write, bantayog_worker;
grant usage on type
  incident_core.report_type,
  incident_core.severity,
  incident_core.operational_status,
  incident_core.verification_status,
  incident_core.publication_status,
  incident_core.incident_source,
  incident_core.location_source,
  incident_core.dispatch_status,
  incident_core.responder_status,
  incident_core.retention_state
to bantayog_public_read, bantayog_ops_read, bantayog_ops_write, bantayog_worker;
grant select on
  incident_core.public_incident_cards,
  incident_core.public_alert_cards
to bantayog_public_read;
grant select on
  incident_core.incidents,
  incident_core.reports,
  incident_core.incident_verifications,
  incident_core.dispatches,
  incident_core.responder_status_events,
  incident_core.incident_locations,
  incident_core.responder_locations,
  incident_core.municipal_boundaries,
  incident_core.alert_areas,
  incident_core.public_alert_cards,
  incident_core.duplicate_cluster_inputs,
  incident_core.audit_events,
  incident_core.public_incident_cards
to bantayog_ops_read, bantayog_ops_write;
grant select, insert, update, delete on
  incident_core.incidents,
  incident_core.reports,
  incident_core.incident_verifications,
  incident_core.dispatches,
  incident_core.responder_status_events,
  incident_core.incident_locations,
  incident_core.responder_locations,
  incident_core.municipal_boundaries,
  incident_core.alert_areas,
  incident_core.public_alert_cards,
  incident_core.duplicate_cluster_inputs,
  incident_core.reporter_privacy_records,
  incident_core.audit_events,
  incident_core.public_incident_cards
to bantayog_worker;

create policy public_read_public_cards
  on incident_core.public_incident_cards
  for select
  to bantayog_public_read
  using (true);

create policy public_read_public_alert_cards
  on incident_core.public_alert_cards
  for select
  to bantayog_public_read
  using (starts_at <= now() and (ends_at is null or ends_at > now()));

create policy ops_read_incidents_by_municipality
  on incident_core.incidents
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (municipality_id = (select incident_core.current_municipality_id()));

create policy ops_read_reports_by_incident_municipality
  on incident_core.reports
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_verifications_by_incident_municipality
  on incident_core.incident_verifications
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_dispatches_by_incident_municipality
  on incident_core.dispatches
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_responder_status_by_incident_municipality
  on incident_core.responder_status_events
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_incident_locations_by_incident_municipality
  on incident_core.incident_locations
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_responder_locations_by_municipality
  on incident_core.responder_locations
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (municipality_id = (select incident_core.current_municipality_id()));

create policy ops_read_boundaries_by_municipality
  on incident_core.municipal_boundaries
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (municipality_id = (select incident_core.current_municipality_id()));

create policy ops_read_alert_areas_by_municipality
  on incident_core.alert_areas
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (municipality_id = (select incident_core.current_municipality_id()));

create policy ops_read_public_alert_cards_by_municipality
  on incident_core.public_alert_cards
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (municipality_id = (select incident_core.current_municipality_id()));

create policy ops_read_duplicate_inputs_by_incident_municipality
  on incident_core.duplicate_cluster_inputs
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_audit_events_by_incident_municipality
  on incident_core.audit_events
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (
    exists (
      select 1 from incident_core.incidents i
      where i.id = incident_id
        and i.municipality_id = (select incident_core.current_municipality_id())
    )
  );

create policy ops_read_public_cards_by_municipality
  on incident_core.public_incident_cards
  for select
  to bantayog_ops_read, bantayog_ops_write
  using (municipality_id = (select incident_core.current_municipality_id()));

create policy worker_all_incidents
  on incident_core.incidents
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_reports
  on incident_core.reports
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_incident_verifications
  on incident_core.incident_verifications
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_dispatches
  on incident_core.dispatches
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_responder_status_events
  on incident_core.responder_status_events
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_incident_locations
  on incident_core.incident_locations
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_responder_locations
  on incident_core.responder_locations
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_municipal_boundaries
  on incident_core.municipal_boundaries
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_alert_areas
  on incident_core.alert_areas
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_public_alert_cards
  on incident_core.public_alert_cards
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_duplicate_cluster_inputs
  on incident_core.duplicate_cluster_inputs
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_reporter_privacy_records
  on incident_core.reporter_privacy_records
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_audit_events
  on incident_core.audit_events
  for all
  to bantayog_worker
  using (true)
  with check (true);

create policy worker_all_public_incident_cards
  on incident_core.public_incident_cards
  for all
  to bantayog_worker
  using (true)
  with check (true);

commit;
