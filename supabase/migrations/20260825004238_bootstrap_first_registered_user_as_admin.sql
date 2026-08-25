create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
  requested_name text;
  bootstrap_role text := 'player';
begin
  if new.email is null then
    raise exception using
      errcode = '23502',
      message = 'SEAL RPG requires an email address for every authenticated user.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('seal-rpg:first-admin-bootstrap', 0)
  );

  if not exists (select 1 from public.profiles) then
    bootstrap_role := 'admin';
  end if;

  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    requested_username := 'operator_' || left(replace(new.id::text, '-', ''), 12);
  end if;

  if char_length(requested_name) < 2 then
    requested_name := requested_username;
  end if;

  insert into public.profiles (id, name, username, email, role, status)
  values (
    new.id,
    left(requested_name, 80),
    requested_username,
    lower(new.email),
    bootstrap_role,
    'active'
  );

  return new;
end;
$function$;
