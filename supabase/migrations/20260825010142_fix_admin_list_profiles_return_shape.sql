create or replace function public.admin_list_profiles()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not (select private.current_user_is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;

  return query
  select profile.*
  from public.profiles profile
  order by profile.name, profile.id;
end;
$function$;
