begin;

drop schema if exists incident_core cascade;

drop role if exists bantayog_worker;
drop role if exists bantayog_ops_write;
drop role if exists bantayog_ops_read;
drop role if exists bantayog_public_read;

commit;

