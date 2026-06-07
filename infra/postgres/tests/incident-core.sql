\set ON_ERROR_STOP on

begin;

set local role bantayog_worker;

insert into incident_core.incidents (
  id,
  report_type,
  severity,
  operational_status,
  verification_status,
  publication_status,
  municipality_id,
  municipality_label,
  barangay_id,
  source,
  created_at,
  updated_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000001',
  'flood',
  'high',
  'resolved',
  'verified',
  'public',
  'daet',
  'Daet',
  'calasgasan',
  'web',
  now(),
  now(),
  1
);

insert into incident_core.reports (
  id,
  incident_id,
  reporter_role,
  description,
  submitted_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'citizen',
  'Floodwater near the market.',
  now(),
  1
);

insert into incident_core.incident_locations (
  incident_id,
  point,
  accuracy_meters,
  source,
  recorded_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000001',
  ST_SetSRID(ST_MakePoint(122.95, 14.11), 4326)::geography,
  20,
  'gps',
  now(),
  1
);

insert into incident_core.responder_locations (
  responder_uid,
  municipality_id,
  point,
  status,
  captured_at,
  updated_at,
  schema_version
) values (
  'responder-1',
  'daet',
  ST_SetSRID(ST_MakePoint(122.951, 14.111), 4326)::geography,
  'available',
  now(),
  now(),
  1
);

insert into incident_core.municipal_boundaries (
  municipality_id,
  name,
  geom,
  schema_version
) values (
  'daet',
  'Daet',
  ST_Multi(ST_MakeEnvelope(122.90, 14.05, 123.00, 14.20, 4326)),
  1
);

insert into incident_core.alert_areas (
  id,
  incident_id,
  municipality_id,
  public_title,
  public_summary,
  geom,
  starts_at,
  ends_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000001',
  'daet',
  'Flood advisory',
  'Avoid the market road while drainage crews clear the area.',
  ST_Multi(ST_MakeEnvelope(122.93, 14.09, 122.97, 14.13, 4326)),
  now() - interval '5 minutes',
  now() + interval '1 hour',
  1
);

insert into incident_core.public_alert_cards (
  alert_id,
  municipality_id,
  public_title,
  public_summary,
  geom,
  starts_at,
  ends_at,
  published_at,
  updated_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000031',
  'daet',
  'Flood advisory',
  'Avoid the market road while drainage crews clear the area.',
  ST_Multi(ST_MakeEnvelope(122.93, 14.09, 122.97, 14.13, 4326)),
  now() - interval '5 minutes',
  now() + interval '1 hour',
  now(),
  now(),
  1
);

insert into incident_core.duplicate_cluster_inputs (
  incident_id,
  point,
  report_type,
  created_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000001',
  ST_SetSRID(ST_MakePoint(122.95, 14.11), 4326)::geography,
  'flood',
  now(),
  1
);

insert into incident_core.reporter_privacy_records (
  incident_id,
  reporter_uid,
  reporter_phone_hash,
  retention_state,
  created_at,
  updated_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000001',
  'citizen-1',
  repeat('a', 64),
  'active',
  now(),
  now(),
  1
);

insert into incident_core.audit_events (
  id,
  incident_id,
  actor_uid,
  action,
  occurred_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'admin-1',
  'incidents.publish',
  now(),
  1
);

insert into incident_core.public_incident_cards (
  incident_id,
  report_type,
  severity,
  operational_status,
  municipality_id,
  municipality_label,
  barangay_id,
  public_summary,
  point,
  published_at,
  updated_at,
  schema_version
) values (
  '00000000-0000-0000-0000-000000000001',
  'flood',
  'high',
  'resolved',
  'daet',
  'Daet',
  'calasgasan',
  'Floodwater has receded near the market.',
  ST_SetSRID(ST_MakePoint(122.95, 14.11), 4326)::geography,
  now(),
  now(),
  1
);

reset role;

set local role bantayog_public_read;

select incident_id
from incident_core.public_incident_cards
where ST_Intersects(
  point::geometry,
  ST_MakeEnvelope(122.90, 14.05, 123.00, 14.20, 4326)
);

select alert_id
from incident_core.public_alert_cards
where starts_at <= now()
  and (ends_at is null or ends_at > now())
  and ST_Intersects(
    geom,
    ST_MakeEnvelope(122.90, 14.05, 123.00, 14.20, 4326)
  );

do $$
begin
  perform 1 from incident_core.reporter_privacy_records;
  raise exception 'public role read privacy records';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform 1 from incident_core.alert_areas;
  raise exception 'public role read operational alert areas';
exception
  when insufficient_privilege then
    null;
end;
$$;

reset role;

set local role bantayog_ops_read;
set local app.municipality_id = 'daet';

select count(*) from incident_core.incidents;
select count(*) from incident_core.audit_events;
select count(*) from incident_core.public_alert_cards;

do $$
begin
  perform 1 from incident_core.reporter_privacy_records;
  raise exception 'ops role read privacy records';
exception
  when insufficient_privilege then
    null;
end;
$$;

with target_incident as (
  select point
  from incident_core.incident_locations
  where incident_id = '00000000-0000-0000-0000-000000000001'
)
select r.responder_uid
from incident_core.responder_locations r
cross join target_incident i
where ST_DWithin(r.point, i.point, 5000)
order by r.point <-> i.point;

select b.municipality_id
from incident_core.municipal_boundaries b
join incident_core.incident_locations i
  on i.incident_id = '00000000-0000-0000-0000-000000000001'
where ST_Contains(b.geom, i.point::geometry);

select count(*)
from incident_core.duplicate_cluster_inputs d
join incident_core.incident_locations i
  on i.incident_id = '00000000-0000-0000-0000-000000000001'
where ST_DWithin(d.point, i.point, 750);

select count(*)
from (
  select ST_ClusterDBSCAN(d.point::geometry, 0.01, 1) over (order by d.incident_id) as cluster_id
  from incident_core.duplicate_cluster_inputs d
  join incident_core.incident_locations i
    on i.incident_id = '00000000-0000-0000-0000-000000000001'
  where ST_DWithin(d.point, i.point, 750)
) clusters
where cluster_id is not null;

set local app.municipality_id = 'basud';

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from incident_core.incidents;
  if visible_count <> 0 then
    raise exception 'ops role crossed municipality scope';
  end if;
end;
$$;

rollback;
