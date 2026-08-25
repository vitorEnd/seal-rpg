grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges for role postgres in schema public
grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges for role postgres in schema public
grant usage, select on sequences to authenticated, service_role;
