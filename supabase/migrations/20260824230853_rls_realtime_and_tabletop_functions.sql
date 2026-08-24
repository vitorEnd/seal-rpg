begin;

create or replace function private.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function private.can_view_campaign(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles viewer
    join public.campaigns campaign on campaign.id = target_campaign_id
    where viewer.id = (select auth.uid())
      and viewer.status = 'active'
      and (
        viewer.role = 'admin'
        or campaign.game_master_user_id = viewer.id
        or exists (
          select 1
          from public.campaign_members membership
          where membership.campaign_id = campaign.id
            and membership.user_id = viewer.id
            and membership.status = 'approved'
        )
      )
  );
$$;

create or replace function private.can_manage_campaign(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles viewer
    join public.campaigns campaign on campaign.id = target_campaign_id
    where viewer.id = (select auth.uid())
      and viewer.status = 'active'
      and (
        viewer.role = 'admin'
        or campaign.game_master_user_id = viewer.id
        or (
          viewer.role = 'game_master'
          and exists (
            select 1
            from public.campaign_members membership
            where membership.campaign_id = campaign.id
              and membership.user_id = viewer.id
              and membership.status = 'approved'
              and membership.role = 'game_master'
          )
        )
      )
  );
$$;

create or replace function private.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_profile_id = (select auth.uid())
    or (select private.current_user_is_admin())
    or exists (
      select 1
      from public.campaigns campaign
      where (select private.can_view_campaign(campaign.id))
        and (
          campaign.game_master_user_id = target_profile_id
          or exists (
            select 1
            from public.campaign_members target_membership
            where target_membership.campaign_id = campaign.id
              and target_membership.user_id = target_profile_id
              and target_membership.status = 'approved'
          )
        )
    );
$$;

create or replace function private.chapter_is_unlocked(target_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_chapters chapter
    where chapter.id = target_chapter_id
      and chapter.status = 'published'
      and (select private.can_view_campaign(chapter.campaign_id))
      and (
        (select private.can_manage_campaign(chapter.campaign_id))
        or not exists (
          select 1
          from public.campaign_chapters earlier
          where earlier.campaign_id = chapter.campaign_id
            and earlier.status = 'published'
            and earlier.completed_at is null
            and (
              earlier.sort_order,
              earlier.title,
              earlier.id
            ) < (
              chapter.sort_order,
              chapter.title,
              chapter.id
            )
        )
      )
  );
$$;

create or replace function private.can_read_game_file(target_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_files file
    where file.id = target_file_id
      and (
        file.visibility = 'public'
        or (
          file.visibility = 'members'
          and (select private.can_view_campaign(file.campaign_id))
          and (
            (select private.can_manage_campaign(file.campaign_id))
            or not (
              exists (
                select 1
                from public.virtual_table_maps map
                where map.image_file_id = file.id
              )
              or exists (
                select 1
                from public.virtual_tables table_session
                where table_session.map_file_id = file.id
              )
              or exists (
                select 1
                from public.virtual_table_tokens token
                where token.image_file_id = file.id
              )
            )
          )
        )
        or (
          file.visibility = 'game_master'
          and (select private.can_manage_campaign(file.campaign_id))
        )
        or (
          file.visibility = 'admin'
          and (select private.current_user_is_admin())
        )
        or (
          (select private.can_view_campaign(file.campaign_id))
          and (
            exists (
              select 1
              from public.virtual_table_maps map
              join public.virtual_tables table_session
                on table_session.campaign_id = map.campaign_id
               and table_session.active_map_id = map.id
               and table_session.status = 'open'
              where map.image_file_id = file.id
            )
            or exists (
              select 1
              from public.virtual_tables table_session
              where table_session.map_file_id = file.id
                and table_session.status = 'open'
            )
            or exists (
              select 1
              from public.virtual_table_tokens token
              join public.virtual_tables table_session
                on table_session.id = token.table_id
               and table_session.campaign_id = token.campaign_id
               and table_session.status = 'open'
               and token.map_id
                 is not distinct from table_session.active_map_id
              where token.image_file_id = file.id
                and token.visible
            )
          )
        )
      )
  );
$$;

create or replace function private.can_manage_game_file(target_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_files file
    where file.id = target_file_id
      and (select private.can_manage_campaign(file.campaign_id))
  );
$$;

create or replace function private.storage_campaign_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if object_name is null or object_name !~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$' then
    return null;
  end if;
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function private.is_public_campaign_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = (select private.storage_campaign_id(object_name))
        and object_name in (
          campaign.cover_image_storage_key,
          campaign.background_image_storage_key
        )
    )
    or exists (
      select 1
      from public.game_files file
      where file.campaign_id = (select private.storage_campaign_id(object_name))
        and file.storage_key = object_name
        and file.visibility = 'public'
    );
$$;

create or replace function private.can_read_campaign_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_public_campaign_media(object_name))
    or (
      (select private.can_view_campaign((select private.storage_campaign_id(object_name))))
      and (
        (select private.can_manage_campaign((select private.storage_campaign_id(object_name))))
        or exists (
          select 1
          from public.campaign_chapters chapter
          where chapter.background_image_storage_key = object_name
            and (select private.chapter_is_unlocked(chapter.id))
        )
        or exists (
          select 1 from public.characters character
          where object_name in (
            character.cover_image_storage_key,
            character.background_image_storage_key
          )
            and not exists (
              select 1
              from public.game_files restricted_file
              where restricted_file.storage_key = object_name
                and not (
                  select private.can_read_game_file(restricted_file.id)
                )
            )
        )
        or exists (
          select 1 from public.character_class_options class_option
          where class_option.logo_image_storage_key = object_name
        )
        or exists (
          select 1
          from public.virtual_table_maps map
          join public.virtual_tables table_session
            on table_session.campaign_id = map.campaign_id
           and table_session.active_map_id = map.id
           and table_session.status = 'open'
          join public.game_files file
            on file.id = map.image_file_id
           and file.campaign_id = map.campaign_id
          where file.storage_key = object_name
        )
        or exists (
          select 1
          from public.virtual_tables table_session
          join public.game_files file
            on file.id = table_session.map_file_id
           and file.campaign_id = table_session.campaign_id
          where table_session.status = 'open'
            and file.storage_key = object_name
        )
        or exists (
          select 1
          from public.virtual_table_tokens token
          join public.virtual_tables table_session
            on table_session.id = token.table_id
           and table_session.campaign_id = token.campaign_id
           and table_session.status = 'open'
           and token.map_id is not distinct from table_session.active_map_id
          join public.game_files file
            on file.id = token.image_file_id
           and file.campaign_id = token.campaign_id
          where token.visible
            and file.storage_key = object_name
        )
        or exists (
          select 1 from public.game_files file
          where file.storage_key = object_name
            and (select private.can_read_game_file(file.id))
        )
      )
    );
$$;

create or replace function private.is_referenced_campaign_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.campaigns campaign
      where object_name in (
        campaign.cover_image_storage_key,
        campaign.background_image_storage_key
      )
    )
    or exists (
      select 1
      from public.campaign_chapters chapter
      where chapter.background_image_storage_key = object_name
    )
    or exists (
      select 1
      from public.characters character
      where object_name in (
        character.cover_image_storage_key,
        character.background_image_storage_key
      )
    )
    or exists (
      select 1
      from public.character_class_options class_option
      where class_option.logo_image_storage_key = object_name
    )
    or exists (
      select 1
      from public.game_files file
      where file.storage_key = object_name
    );
$$;

create or replace function private.can_access_vtt_topic(topic_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  table_id uuid;
begin
  if topic_name is null or topic_name !~* (
    '^vtt:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' ||
    '[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    return false;
  end if;
  table_id := split_part(topic_name, ':', 2)::uuid;
  return exists (
    select 1
    from public.virtual_tables virtual_table
    where virtual_table.id = table_id
      and virtual_table.status = 'open'
      and (select private.can_view_campaign(virtual_table.campaign_id))
  );
exception when invalid_text_representation then
  return false;
end;
$$;

create or replace function private.can_upload_campaign_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.storage_campaign_id(object_name)) is not null
    and (select private.can_view_campaign(
      (select private.storage_campaign_id(object_name))
    ));
$$;

create or replace function private.can_manage_campaign_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.storage_campaign_id(object_name)) is not null
    and (select private.can_manage_campaign(
      (select private.storage_campaign_id(object_name))
    ));
$$;

create or replace function private.can_view_virtual_table_map(target_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.virtual_table_maps map
    where map.id = target_map_id
      and (
        (select private.can_manage_campaign(map.campaign_id))
        or (
          (select private.can_view_campaign(map.campaign_id))
          and exists (
            select 1
            from public.virtual_tables table_session
            where table_session.campaign_id = map.campaign_id
              and table_session.status = 'open'
              and table_session.active_map_id = map.id
          )
        )
      )
  );
$$;

create or replace function private.can_write_character(target_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.characters character
    where character.id = target_character_id
      and (
        (select private.current_user_is_admin())
        or (
          character.user_id = (select auth.uid())
          and (select private.can_view_campaign(character.campaign_id))
        )
      )
  );
$$;

create or replace function private.can_control_virtual_table_token(
  target_table_id uuid,
  target_token_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.virtual_tables table_session
    join public.virtual_table_tokens token
      on token.table_id = table_session.id
     and token.campaign_id = table_session.campaign_id
    left join public.characters character
      on character.id = token.character_id
     and character.campaign_id = token.campaign_id
    where table_session.id = target_table_id
      and table_session.status = 'open'
      and token.id = target_token_id
      and token.map_id is not distinct from table_session.active_map_id
      and (
        (select private.can_manage_campaign(table_session.campaign_id))
        or (
          token.visible
          and token.character_id is not null
          and character.user_id = (select auth.uid())
          and (select private.can_view_campaign(table_session.campaign_id))
        )
      )
  );
$$;

create or replace function private.protect_character_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.campaign_id is distinct from old.campaign_id
    or new.user_id is distinct from old.user_id
  ) and not (select private.current_user_is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'CHARACTER_IDENTITY_CHANGE_DENIED';
  end if;
  return new;
end;
$$;

create trigger characters_protect_identity
before update of campaign_id, user_id on public.characters
for each row execute function private.protect_character_identity();

create or replace function private.validate_character_media_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_key text;
  candidate_keys text[];
  manager_access boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  manager_access := (select private.can_manage_campaign(new.campaign_id));

  if tg_op = 'UPDATE' then
    candidate_keys := array[
      case
        when new.campaign_id is distinct from old.campaign_id
          or new.cover_image_storage_key
            is distinct from old.cover_image_storage_key
          then new.cover_image_storage_key
        else null
      end,
      case
        when new.campaign_id is distinct from old.campaign_id
          or new.background_image_storage_key
            is distinct from old.background_image_storage_key
          then new.background_image_storage_key
        else null
      end
    ];
  else
    candidate_keys := array[
      new.cover_image_storage_key,
      new.background_image_storage_key
    ];
  end if;

  foreach candidate_key in array candidate_keys loop
    if candidate_key is null then
      continue;
    end if;
    if (select private.storage_campaign_id(candidate_key)) is distinct from new.campaign_id
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'campaign-media'
           and object.name = candidate_key
       )
       or exists (
         select 1
         from public.game_files file
         where file.storage_key = candidate_key
           and (
             file.campaign_id is distinct from new.campaign_id
             or file.visibility not in ('public', 'members')
           )
       )
       or (
         not manager_access
         and not exists (
           select 1
           from storage.objects object
           where object.bucket_id = 'campaign-media'
             and object.name = candidate_key
             and object.owner_id = (select auth.uid()::text)
         )
       ) then
      raise exception using
        errcode = '42501',
        message = 'CHARACTER_MEDIA_ASSIGNMENT_DENIED';
    end if;
  end loop;

  return new;
end;
$$;

create trigger characters_validate_media_assignment
before insert or update of
  campaign_id,
  user_id,
  cover_image_storage_key,
  background_image_storage_key
on public.characters
for each row execute function private.validate_character_media_assignment();

create or replace function private.protect_game_file_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception using
      errcode = '23514',
      message = 'GAME_FILE_CAMPAIGN_CHANGE_DENIED';
  end if;
  return new;
end;
$$;

create trigger game_files_protect_campaign
before update of campaign_id on public.game_files
for each row execute function private.protect_game_file_campaign();

create or replace function private.protect_character_media_file_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.storage_key is not null
     and exists (
       select 1
       from public.characters character
       where new.storage_key in (
         character.cover_image_storage_key,
         character.background_image_storage_key
       )
         and (
           character.campaign_id is distinct from new.campaign_id
           or new.visibility in ('game_master', 'admin')
         )
     ) then
    raise exception using
      errcode = '23514',
      message = 'CHARACTER_MEDIA_FILE_VISIBILITY_DENIED';
  end if;
  return new;
end;
$$;

create trigger game_files_protect_character_media_visibility
before insert or update of campaign_id, storage_key, visibility
on public.game_files
for each row execute function private.protect_character_media_file_visibility();

create or replace function private.bump_virtual_table_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revision = old.revision and (
    new.status is distinct from old.status
    or new.map_file_id is distinct from old.map_file_id
    or new.active_map_id is distinct from old.active_map_id
    or new.opened_by_user_id is distinct from old.opened_by_user_id
    or new.opened_at is distinct from old.opened_at
    or new.closed_at is distinct from old.closed_at
  ) then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

create trigger virtual_tables_bump_revision
before update on public.virtual_tables
for each row execute function private.bump_virtual_table_revision();

create or replace function private.touch_virtual_table_from_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_table_id uuid;
begin
  affected_table_id := coalesce(new.table_id, old.table_id);
  update public.virtual_tables
  set revision = revision + 1
  where id = affected_table_id;
  return coalesce(new, old);
end;
$$;

create trigger virtual_table_tokens_touch_table
after insert or update or delete on public.virtual_table_tokens
for each row execute function private.touch_virtual_table_from_child();

create trigger dice_rolls_touch_table
after insert on public.dice_rolls
for each row execute function private.touch_virtual_table_from_child();

create or replace function private.broadcast_virtual_table_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'tableId', new.id,
      'revision', new.revision
    ),
    'table_invalidated',
    'vtt:' || new.id::text,
    true
  );
  return new;
end;
$$;

create trigger virtual_tables_broadcast_revision
after update of revision on public.virtual_tables
for each row
when (old.revision is distinct from new.revision)
execute function private.broadcast_virtual_table_revision();

create or replace function private.touch_open_tables_from_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.virtual_tables
  set revision = revision + 1
  where campaign_id = new.campaign_id
    and status = 'open';
  return new;
end;
$$;

create trigger characters_touch_open_tables
after update of
  name,
  cover_image_url,
  cover_image_storage_key,
  equipment,
  wounds,
  backpack_items,
  inventory_slots
on public.characters
for each row execute function private.touch_open_tables_from_character();

create or replace function private.touch_open_tables_from_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.virtual_tables
  set revision = revision + 1
  where active_map_id = new.id
    and status = 'open';
  return new;
end;
$$;

create trigger virtual_table_maps_touch_open_tables
after update of
  name,
  description,
  group_name,
  layer_name,
  image_file_id,
  built_in_image_url,
  scale
on public.virtual_table_maps
for each row execute function private.touch_open_tables_from_map();

create or replace function public.get_current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select profile
  from public.profiles profile
  where profile.id = (select auth.uid())
    and profile.status = 'active';
$$;

create or replace function public.list_campaign_profiles(target_campaign_id uuid)
returns table (
  id uuid,
  name text,
  username text,
  avatar_url text,
  role text,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.can_view_campaign(target_campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'CAMPAIGN_ACCESS_DENIED';
  end if;

  return query
  select distinct
    profile.id,
    profile.name,
    profile.username,
    profile.avatar_url,
    profile.role,
    profile.status
  from public.profiles profile
  where profile.status = 'active'
    and (
      exists (
        select 1
        from public.campaigns campaign
        where campaign.id = target_campaign_id
          and campaign.game_master_user_id = profile.id
      )
      or exists (
        select 1
        from public.campaign_members membership
        where membership.campaign_id = target_campaign_id
          and membership.user_id = profile.id
          and membership.status = 'approved'
      )
    )
  order by profile.name, profile.id;
end;
$$;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.current_user_is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;

  return query
  select profile
  from public.profiles profile
  order by profile.name, profile.id;
end;
$$;

create or replace function public.admin_update_profile_access(
  target_profile_id uuid,
  target_role text,
  target_status text
)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
begin
  if not (select private.current_user_is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;
  if target_role not in ('admin', 'game_master', 'player')
     or target_status not in ('active', 'disabled') then
    raise exception using
      errcode = '22023',
      message = 'INVALID_PROFILE_ACCESS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('seal-rpg:active-admins', 0)
  );

  select profile.*
  into current_profile
  from public.profiles profile
  where profile.id = target_profile_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PROFILE_NOT_FOUND';
  end if;

  if current_profile.role = 'admin'
     and current_profile.status = 'active'
     and (target_role <> 'admin' or target_status <> 'active')
     and not exists (
       select 1
       from public.profiles other_admin
       where other_admin.id <> current_profile.id
         and other_admin.role = 'admin'
         and other_admin.status = 'active'
     ) then
    raise exception using
      errcode = '23514',
      message = 'LAST_ACTIVE_ADMIN_REQUIRED';
  end if;

  update public.profiles
  set role = target_role,
      status = target_status
  where id = target_profile_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.list_public_campaign_cards()
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  genre text,
  status text,
  cover_image_url text,
  background_image_url text,
  primary_color text,
  secondary_color text,
  player_count bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    campaign.id,
    campaign.name,
    campaign.slug,
    campaign.short_description,
    campaign.genre,
    campaign.status,
    campaign.cover_image_url,
    campaign.background_image_url,
    campaign.primary_color,
    campaign.secondary_color,
    count(membership.id) filter (
      where membership.status = 'approved'
        and membership.role = 'player'
    ) as player_count,
    campaign.updated_at
  from public.campaigns campaign
  left join public.campaign_members membership
    on membership.campaign_id = campaign.id
  group by campaign.id
  order by campaign.updated_at desc, campaign.name, campaign.id;
$$;

create or replace function public.request_campaign_membership(target_campaign_id uuid)
returns public.campaign_members
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  membership public.campaign_members%rowtype;
begin
  if current_user_id is null
     or not (select private.current_profile_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.campaigns where id = target_campaign_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  select existing.*
  into membership
  from public.campaign_members existing
  where existing.campaign_id = target_campaign_id
    and existing.user_id = current_user_id
  for update;

  if found and membership.status = 'approved' then
    return membership;
  end if;

  if found then
    update public.campaign_members
    set role = 'player',
        status = 'pending',
        joined_at = now()
    where id = membership.id
    returning * into membership;
  else
    insert into public.campaign_members as existing_membership (
      campaign_id,
      user_id,
      role,
      status
    ) values (
      target_campaign_id,
      current_user_id,
      'player',
      'pending'
    )
    on conflict (campaign_id, user_id) do update
    set role = case
          when existing_membership.status = 'approved'
            then existing_membership.role
          else 'player'
        end,
        status = case
          when existing_membership.status = 'approved'
            then 'approved'
          else 'pending'
        end,
        joined_at = case
          when existing_membership.status = 'approved'
            then existing_membership.joined_at
          else now()
        end
    returning * into membership;
  end if;

  return membership;
end;
$$;

create or replace function public.get_campaign_chapter_timeline(
  target_campaign_id uuid
)
returns table (
  chapter_position integer,
  chapter_id uuid,
  state text,
  is_locked boolean,
  title text,
  slug text,
  short_description text,
  description text,
  background_image_url text,
  background_image_storage_key text,
  sort_order smallint,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.can_view_campaign(target_campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'CAMPAIGN_ACCESS_DENIED';
  end if;

  return query
  with ordered as (
    select
      chapter.*,
      row_number() over (
        order by chapter.sort_order, chapter.title, chapter.id
      )::integer as chapter_position
    from public.campaign_chapters chapter
    where chapter.campaign_id = target_campaign_id
      and chapter.status = 'published'
  ), progression as (
    select
      ordered.*,
      min(ordered.chapter_position) filter (
        where ordered.completed_at is null
      ) over () as current_position
    from ordered
  ), visible as (
    select
      progression.*,
      progression.current_position is not null
        and progression.chapter_position > progression.current_position
        as locked,
      not (select private.can_manage_campaign(target_campaign_id))
        and progression.current_position is not null
        and progression.chapter_position > progression.current_position
        as redacted
    from progression
  )
  select
    visible.chapter_position,
    case when visible.redacted then null else visible.id end,
    case
      when visible.current_position is null then 'completed'
      when visible.chapter_position < visible.current_position then 'completed'
      when visible.chapter_position = visible.current_position then 'available'
      else 'locked'
    end,
    visible.locked,
    case when visible.redacted then 'Não desbloqueado' else visible.title end,
    case when visible.redacted then null else visible.slug end,
    case when visible.redacted then null else visible.short_description end,
    case when visible.redacted then null else visible.description end,
    case when visible.redacted then null else visible.background_image_url end,
    case when visible.redacted then null else visible.background_image_storage_key end,
    visible.sort_order,
    case when visible.redacted then null else visible.completed_at end,
    case when visible.redacted then null else visible.created_at end,
    case when visible.redacted then null else visible.updated_at end
  from visible
  order by visible.chapter_position;
end;
$$;

create or replace function public.update_character_loadout(
  target_character_id uuid,
  new_equipment text[],
  new_wounds text[],
  new_backpack_items text[],
  new_inventory_slots smallint
)
returns public.characters
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  character_record public.characters%rowtype;
begin
  select character.*
  into character_record
  from public.characters character
  where character.id = target_character_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CHARACTER_NOT_FOUND';
  end if;
  if not (
    (
      character_record.user_id = (select auth.uid())
      and (select private.current_profile_is_active())
      and (select private.can_view_campaign(character_record.campaign_id))
    )
    or (select private.can_manage_campaign(character_record.campaign_id))
  ) then
    raise exception using
      errcode = '42501',
      message = 'CHARACTER_LOADOUT_DENIED';
  end if;
  if new_inventory_slots not between 1 and 40
     or cardinality(new_equipment) > 30
     or cardinality(new_wounds) > 30
     or cardinality(new_backpack_items) > 40
     or cardinality(new_backpack_items) > new_inventory_slots
     or exists (
       select 1
       from unnest(new_equipment) item
       where item is null or char_length(trim(item)) not between 1 and 120
     )
     or exists (
       select 1
       from unnest(new_wounds) item
       where item is null or char_length(trim(item)) not between 1 and 180
     )
     or exists (
       select 1
       from unnest(new_backpack_items) item
       where item is null or char_length(trim(item)) not between 1 and 120
     ) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_CHARACTER_LOADOUT';
  end if;

  update public.characters
  set equipment = new_equipment,
      wounds = new_wounds,
      backpack_items = new_backpack_items,
      inventory_slots = new_inventory_slots
  where id = target_character_id
  returning * into character_record;

  return character_record;
end;
$$;

create or replace function public.open_virtual_table(
  target_campaign_id uuid,
  target_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_session public.campaign_sessions%rowtype;
  table_session public.virtual_tables%rowtype;
  first_map_id uuid;
  next_session_number smallint;
  operation_time timestamptz := statement_timestamp();
begin
  if current_user_id is null
     or not (select private.can_manage_campaign(target_campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'TABLE_MANAGEMENT_DENIED';
  end if;

  perform 1
  from public.campaigns campaign
  where campaign.id = target_campaign_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  select existing_table.*
  into table_session
  from public.virtual_tables existing_table
  where existing_table.campaign_id = target_campaign_id
    and existing_table.status = 'open'
  for update;
  if found then
    select campaign_session.*
    into selected_session
    from public.campaign_sessions campaign_session
    where campaign_session.id = table_session.session_id;
    return jsonb_build_object(
      'table', to_jsonb(table_session),
      'session', to_jsonb(selected_session)
    );
  end if;

  if target_session_id is not null then
    select campaign_session.*
    into selected_session
    from public.campaign_sessions campaign_session
    where campaign_session.id = target_session_id
      and campaign_session.campaign_id = target_campaign_id
      and campaign_session.status = 'scheduled'
    for update;
    if not found then
      raise exception using
        errcode = '22023',
        message = 'SCHEDULED_SESSION_NOT_FOUND';
    end if;
  else
    select campaign_session.*
    into selected_session
    from public.campaign_sessions campaign_session
    where campaign_session.campaign_id = target_campaign_id
      and campaign_session.status = 'scheduled'
    order by
      campaign_session.scheduled_at,
      campaign_session.session_number,
      campaign_session.id
    limit 1
    for update;

    if not found then
      select (coalesce(max(campaign_session.session_number), 0) + 1)::smallint
      into next_session_number
      from public.campaign_sessions campaign_session
      where campaign_session.campaign_id = target_campaign_id;

      insert into public.campaign_sessions (
        campaign_id,
        session_number,
        title,
        status,
        scheduled_at,
        occurred_at,
        summary,
        description,
        events,
        consequences
      ) values (
        target_campaign_id,
        next_session_number,
        'Sessão ' || lpad(next_session_number::text, 2, '0'),
        'scheduled',
        operation_time,
        null,
        '',
        '',
        '',
        ''
      )
      returning * into selected_session;
    end if;
  end if;

  select map.id
  into first_map_id
  from public.virtual_table_maps map
  where map.campaign_id = target_campaign_id
  order by map.sort_order, map.group_name, map.layer_name, map.id
  limit 1;

  select existing_table.*
  into table_session
  from public.virtual_tables existing_table
  where existing_table.session_id = selected_session.id
  for update;

  if found then
    update public.virtual_tables
    set status = 'open',
        opened_by_user_id = current_user_id,
        opened_at = operation_time,
        closed_at = null
    where id = table_session.id
    returning * into table_session;
  else
    insert into public.virtual_tables (
      campaign_id,
      session_id,
      status,
      map_file_id,
      active_map_id,
      opened_by_user_id,
      opened_at,
      closed_at
    ) values (
      target_campaign_id,
      selected_session.id,
      'open',
      null,
      first_map_id,
      current_user_id,
      operation_time,
      null
    )
    returning * into table_session;
  end if;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'session', to_jsonb(selected_session)
  );
end;
$$;

create or replace function public.close_virtual_table(target_table_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  table_session public.virtual_tables%rowtype;
  campaign_session public.campaign_sessions%rowtype;
  operation_time timestamptz := statement_timestamp();
begin
  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TABLE_NOT_FOUND';
  end if;
  if not (select private.can_manage_campaign(table_session.campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'TABLE_MANAGEMENT_DENIED';
  end if;

  select current_session.*
  into campaign_session
  from public.campaign_sessions current_session
  where current_session.id = table_session.session_id
    and current_session.campaign_id = table_session.campaign_id
  for update;

  if table_session.status = 'closed' then
    if campaign_session.status <> 'completed' then
      raise exception using
        errcode = '23514',
        message = 'CLOSED_TABLE_SESSION_MISMATCH';
    end if;
    return jsonb_build_object(
      'table', to_jsonb(table_session),
      'session', to_jsonb(campaign_session)
    );
  end if;

  update public.campaign_sessions
  set status = 'completed',
      occurred_at = coalesce(occurred_at, operation_time)
  where id = campaign_session.id
  returning * into campaign_session;

  update public.virtual_tables
  set status = 'closed',
      closed_at = operation_time
  where id = table_session.id
  returning * into table_session;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'session', to_jsonb(campaign_session)
  );
end;
$$;

create or replace function public.admin_update_campaign_session_and_close_table(
  target_session_id uuid,
  target_campaign_id uuid,
  new_session_number smallint,
  new_title text,
  new_status text,
  new_scheduled_at timestamptz,
  new_occurred_at timestamptz,
  new_summary text,
  new_description text,
  new_events text,
  new_consequences text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_session public.campaign_sessions%rowtype;
  table_session public.virtual_tables%rowtype;
  operation_time timestamptz := statement_timestamp();
begin
  if not (select private.current_user_is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;
  if new_status not in ('completed', 'cancelled') then
    raise exception using
      errcode = '22023',
      message = 'CLOSING_SESSION_STATUS_REQUIRED';
  end if;

  select campaign_session.*
  into selected_session
  from public.campaign_sessions campaign_session
  where campaign_session.id = target_session_id
    and campaign_session.campaign_id = target_campaign_id;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_NOT_FOUND';
  end if;

  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.session_id = selected_session.id
    and current_table.campaign_id = selected_session.campaign_id
    and current_table.status = 'open'
  for update;

  select campaign_session.*
  into selected_session
  from public.campaign_sessions campaign_session
  where campaign_session.id = target_session_id
    and campaign_session.campaign_id = target_campaign_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_NOT_FOUND';
  end if;

  update public.campaign_sessions
  set session_number = new_session_number,
      title = new_title,
      status = new_status,
      scheduled_at = new_scheduled_at,
      occurred_at = new_occurred_at,
      summary = new_summary,
      description = new_description,
      events = new_events,
      consequences = new_consequences
  where id = selected_session.id
  returning * into selected_session;

  if table_session.id is not null then
    update public.virtual_tables
    set status = 'closed',
        closed_at = operation_time
    where id = table_session.id
    returning * into table_session;
  end if;

  return jsonb_build_object(
    'session', to_jsonb(selected_session),
    'table', case
      when table_session.id is null then null
      else to_jsonb(table_session)
    end
  );
end;
$$;

create or replace function public.activate_virtual_table_map(
  target_table_id uuid,
  target_map_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  table_session public.virtual_tables%rowtype;
  selected_map public.virtual_table_maps%rowtype;
begin
  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id
  for update;

  if not found or table_session.status <> 'open' then
    raise exception using
      errcode = 'P0002',
      message = 'TABLE_NOT_OPEN';
  end if;
  if not (select private.can_manage_campaign(table_session.campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'TABLE_MANAGEMENT_DENIED';
  end if;

  select map.*
  into selected_map
  from public.virtual_table_maps map
  where map.id = target_map_id
    and map.campaign_id = table_session.campaign_id
  for share;
  if not found then
    raise exception using
      errcode = '22023',
      message = 'MAP_NOT_IN_CAMPAIGN';
  end if;

  update public.virtual_tables
  set active_map_id = selected_map.id,
      map_file_id = null,
      revision = revision + 1
  where id = table_session.id
  returning * into table_session;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'map', to_jsonb(selected_map)
  );
end;
$$;

create or replace function public.set_virtual_table_map_file(
  target_table_id uuid,
  target_map_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  table_session public.virtual_tables%rowtype;
  previous_map_file_id uuid;
begin
  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id
  for update;
  if not found or table_session.status <> 'open' then
    raise exception using
      errcode = 'P0002',
      message = 'TABLE_NOT_OPEN';
  end if;
  if not (select private.can_manage_campaign(table_session.campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'TABLE_MANAGEMENT_DENIED';
  end if;
  if target_map_file_id is not null
     and not exists (
       select 1
       from public.game_files file
       where file.id = target_map_file_id
         and file.campaign_id = table_session.campaign_id
         and file.category in ('map', 'image')
     ) then
    raise exception using
      errcode = '22023',
      message = 'MAP_FILE_NOT_IN_CAMPAIGN';
  end if;

  previous_map_file_id := table_session.map_file_id;
  update public.virtual_tables
  set map_file_id = target_map_file_id,
      active_map_id = null
  where id = table_session.id
  returning * into table_session;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'previousMapFileId', previous_map_file_id
  );
end;
$$;

create or replace function public.delete_virtual_table_map(target_map_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_map public.virtual_table_maps%rowtype;
  fallback_map_id uuid;
begin
  select map.*
  into selected_map
  from public.virtual_table_maps map
  where map.id = target_map_id
  for update;

  if not found then
    return jsonb_build_object('deleted', false, 'fileId', null);
  end if;
  if not (select private.can_manage_campaign(selected_map.campaign_id)) then
    raise exception using
      errcode = '42501',
      message = 'TABLE_MANAGEMENT_DENIED';
  end if;
  if selected_map.built_in then
    raise exception using
      errcode = '23514',
      message = 'BUILT_IN_MAP_DELETE_DENIED';
  end if;
  if exists (
    select 1
    from public.virtual_table_tokens token
    where token.map_id = selected_map.id
  ) then
    raise exception using
      errcode = '23503',
      message = 'MAP_STILL_HAS_TOKENS';
  end if;

  select map.id
  into fallback_map_id
  from public.virtual_table_maps map
  where map.campaign_id = selected_map.campaign_id
    and map.id <> selected_map.id
  order by map.sort_order, map.group_name, map.layer_name, map.id
  limit 1;

  update public.virtual_tables
  set active_map_id = fallback_map_id,
      revision = revision + 1
  where active_map_id = selected_map.id;

  delete from public.virtual_table_maps
  where id = selected_map.id;

  return jsonb_build_object(
    'deleted', true,
    'fileId', selected_map.image_file_id,
    'fallbackMapId', fallback_map_id
  );
end;
$$;

create or replace function public.move_virtual_table_token(
  target_table_id uuid,
  target_token_id uuid,
  target_x double precision,
  target_y double precision
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  table_session public.virtual_tables%rowtype;
  token_record public.virtual_table_tokens%rowtype;
  controller_user_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if target_x is null
     or target_y is null
     or target_x = 'NaN'::double precision
     or target_y = 'NaN'::double precision
     or target_x < 0 or target_x > 1
     or target_y < 0 or target_y > 1 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_TOKEN_POSITION';
  end if;

  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id
  for update;
  if not found or table_session.status <> 'open' then
    raise exception using
      errcode = 'P0002',
      message = 'TABLE_NOT_OPEN';
  end if;

  select token.*
  into token_record
  from public.virtual_table_tokens token
  where token.id = target_token_id
    and token.table_id = table_session.id
    and token.campaign_id = table_session.campaign_id
    and token.map_id is not distinct from table_session.active_map_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TOKEN_NOT_FOUND';
  end if;

  if token_record.character_id is not null then
    select character.user_id
    into controller_user_id
    from public.characters character
    where character.id = token_record.character_id
      and character.campaign_id = token_record.campaign_id;
  end if;

  if not (
    (select private.can_manage_campaign(table_session.campaign_id))
    or (
      token_record.visible
      and token_record.character_id is not null
      and controller_user_id = (select auth.uid())
      and (select private.can_view_campaign(table_session.campaign_id))
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'TOKEN_CONTROL_DENIED';
  end if;

  if token_record.x is distinct from target_x
     or token_record.y is distinct from target_y then
    update public.virtual_table_tokens
    set x = target_x,
        y = target_y
    where id = token_record.id
    returning * into token_record;

    select current_table.*
    into table_session
    from public.virtual_tables current_table
    where current_table.id = target_table_id;
  end if;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'token', to_jsonb(token_record)
  );
end;
$$;

create or replace function public.broadcast_virtual_table_token_preview(
  target_table_id uuid,
  target_token_id uuid,
  target_x double precision,
  target_y double precision
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_x is null
     or target_y is null
     or target_x = 'NaN'::double precision
     or target_y = 'NaN'::double precision
     or target_x < 0 or target_x > 1
     or target_y < 0 or target_y > 1 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_TOKEN_POSITION';
  end if;
  if not (
    select private.can_control_virtual_table_token(
      target_table_id,
      target_token_id
    )
  ) or not exists (
    select 1
    from public.virtual_table_tokens token
    where token.id = target_token_id
      and token.table_id = target_table_id
      and token.visible
  ) then
    raise exception using
      errcode = '42501',
      message = 'TOKEN_CONTROL_DENIED';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'tableId', target_table_id,
      'tokenId', target_token_id,
      'x', target_x,
      'y', target_y
    ),
    'token_drag_preview',
    'vtt:' || target_table_id::text,
    true
  );

  return true;
end;
$$;

create or replace function public.roll_virtual_table_dice(
  target_table_id uuid,
  requested_expression text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  table_session public.virtual_tables%rowtype;
  profile_record public.profiles%rowtype;
  roll_record public.dice_rolls%rowtype;
  normalized_input text;
  expression_parts text[];
  dice_count integer;
  dice_sides integer;
  dice_modifier integer;
  normalized_expression text;
  rolled_values smallint[];
  rolled_total integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id
  for update;
  if not found or table_session.status <> 'open' then
    raise exception using errcode = 'P0002', message = 'TABLE_NOT_OPEN';
  end if;
  if not (select private.can_view_campaign(table_session.campaign_id)) then
    raise exception using errcode = '42501', message = 'TABLE_ACCESS_DENIED';
  end if;

  select profile.*
  into profile_record
  from public.profiles profile
  where profile.id = current_user_id
    and profile.status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'ACTIVE_PROFILE_REQUIRED';
  end if;

  normalized_input := lower(regexp_replace(trim(requested_expression), '\s+', '', 'g'));
  expression_parts := regexp_match(
    normalized_input,
    '^(\d{0,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$'
  );
  if expression_parts is null then
    raise exception using errcode = '22023', message = 'INVALID_DICE_EXPRESSION';
  end if;

  dice_count := coalesce(nullif(expression_parts[1], '')::integer, 1);
  dice_sides := expression_parts[2]::integer;
  dice_modifier := coalesce(expression_parts[3]::integer, 0);
  if dice_count not between 1 and 20
     or dice_sides not in (4, 6, 8, 10, 12, 20, 100)
     or abs(dice_modifier) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_DICE_EXPRESSION';
  end if;

  normalized_expression := dice_count::text || 'd' || dice_sides::text ||
    case
      when dice_modifier > 0 then '+' || dice_modifier::text
      when dice_modifier < 0 then dice_modifier::text
      else ''
    end;

  select array_agg(
    (floor(random() * dice_sides) + 1)::smallint
    order by roll_number
  )
  into rolled_values
  from generate_series(1, dice_count) roll_number;

  select coalesce(sum(value), 0)::integer + dice_modifier
  into rolled_total
  from unnest(rolled_values) value;

  insert into public.dice_rolls (
    table_id,
    campaign_id,
    session_id,
    user_id,
    actor_name,
    expression,
    dice_values,
    modifier,
    total
  ) values (
    table_session.id,
    table_session.campaign_id,
    table_session.session_id,
    current_user_id,
    profile_record.name,
    normalized_expression,
    rolled_values,
    dice_modifier,
    rolled_total
  )
  returning * into roll_record;

  delete from public.dice_rolls old_roll
  where old_roll.table_id = table_session.id
    and old_roll.id in (
      select stale_roll.id
      from public.dice_rolls stale_roll
      where stale_roll.table_id = table_session.id
      order by stale_roll.created_at desc, stale_roll.id desc
      offset 100
    );

  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'roll', to_jsonb(roll_record)
  );
end;
$$;

create or replace function public.advance_virtual_table_chapter(
  target_table_id uuid,
  expected_current_chapter_id uuid,
  expected_next_chapter_id uuid,
  target_map_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  table_session public.virtual_tables%rowtype;
  current_chapter public.campaign_chapters%rowtype;
  next_chapter public.campaign_chapters%rowtype;
  selected_map public.virtual_table_maps%rowtype;
  next_chapter_id uuid;
  resulting_map_id uuid;
  transition_id uuid;
  operation_time timestamptz := statement_timestamp();
begin
  select current_table.*
  into table_session
  from public.virtual_tables current_table
  where current_table.id = target_table_id
  for update;
  if not found or table_session.status <> 'open' then
    raise exception using errcode = 'P0002', message = 'TABLE_NOT_OPEN';
  end if;
  if not (select private.can_manage_campaign(table_session.campaign_id)) then
    raise exception using errcode = '42501', message = 'CHAPTER_ADVANCE_DENIED';
  end if;

  select chapter.*
  into current_chapter
  from public.campaign_chapters chapter
  where chapter.campaign_id = table_session.campaign_id
    and chapter.status = 'published'
    and chapter.completed_at is null
  order by chapter.sort_order, chapter.title, chapter.id
  limit 1
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NO_CURRENT_CHAPTER';
  end if;
  if current_chapter.id is distinct from expected_current_chapter_id then
    raise exception using errcode = '40001', message = 'CURRENT_CHAPTER_CHANGED';
  end if;

  select chapter.*
  into next_chapter
  from public.campaign_chapters chapter
  where chapter.campaign_id = table_session.campaign_id
    and chapter.status = 'published'
    and (
      chapter.sort_order,
      chapter.title,
      chapter.id
    ) > (
      current_chapter.sort_order,
      current_chapter.title,
      current_chapter.id
    )
  order by chapter.sort_order, chapter.title, chapter.id
  limit 1
  for update;
  next_chapter_id := case when found then next_chapter.id else null end;

  if expected_next_chapter_id is distinct from next_chapter_id then
    raise exception using errcode = '40001', message = 'NEXT_CHAPTER_CHANGED';
  end if;

  if next_chapter_id is not null then
    if target_map_id is null then
      raise exception using errcode = '22023', message = 'NEXT_CHAPTER_MAP_REQUIRED';
    end if;
    select map.*
    into selected_map
    from public.virtual_table_maps map
    where map.id = target_map_id
      and map.campaign_id = table_session.campaign_id
    for share;
    if not found then
      raise exception using errcode = '22023', message = 'MAP_NOT_IN_CAMPAIGN';
    end if;
    resulting_map_id := selected_map.id;
  else
    if target_map_id is not null then
      raise exception using
        errcode = '22023',
        message = 'FINAL_CHAPTER_DOES_NOT_ACCEPT_MAP';
    end if;
    resulting_map_id := table_session.active_map_id;
  end if;

  update public.campaign_chapters
  set completed_at = operation_time
  where id = current_chapter.id
    and completed_at is null
  returning * into current_chapter;
  if not found then
    raise exception using errcode = '40001', message = 'CURRENT_CHAPTER_CHANGED';
  end if;

  insert into public.chapter_transitions (
    campaign_id,
    table_id,
    from_chapter_id,
    to_chapter_id,
    map_id,
    occurred_at
  ) values (
    table_session.campaign_id,
    table_session.id,
    current_chapter.id,
    next_chapter_id,
    resulting_map_id,
    operation_time
  )
  returning id into transition_id;

  update public.virtual_tables
  set active_map_id = case
        when next_chapter_id is not null then resulting_map_id
        else active_map_id
      end,
      map_file_id = case
        when next_chapter_id is not null then null
        else map_file_id
      end,
      revision = revision + 1
  where id = table_session.id
    and status = 'open'
  returning * into table_session;
  if not found then
    raise exception using errcode = '40001', message = 'TABLE_STATE_CHANGED';
  end if;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'completedChapter', to_jsonb(current_chapter),
    'nextChapter', case
      when next_chapter_id is null then null
      else to_jsonb(next_chapter)
    end,
    'map', case
      when next_chapter_id is null then null
      else to_jsonb(selected_map)
    end,
    'transitionId', transition_id,
    'occurredAt', operation_time
  );
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.current_profile_is_active() to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on function private.can_view_campaign(uuid) to authenticated;
grant execute on function private.can_manage_campaign(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.chapter_is_unlocked(uuid) to authenticated;
grant execute on function private.can_read_game_file(uuid) to authenticated;
grant execute on function private.can_manage_game_file(uuid) to authenticated;
grant execute on function private.is_public_campaign_media(text) to anon, authenticated;
grant execute on function private.can_read_campaign_media(text) to authenticated;
grant execute on function private.can_upload_campaign_media(text) to authenticated;
grant execute on function private.can_manage_campaign_media(text) to authenticated;
grant execute on function private.is_referenced_campaign_media(text)
  to authenticated;
grant execute on function private.can_view_virtual_table_map(uuid)
  to authenticated;
grant execute on function private.can_write_character(uuid) to authenticated;
grant execute on function private.can_access_vtt_topic(text) to authenticated;
grant execute on function private.text_array_items_are_valid(text[], integer)
  to authenticated;

revoke all on function public.get_current_profile() from public, anon, authenticated;
revoke all on function public.list_campaign_profiles(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_profiles() from public, anon, authenticated;
revoke all on function public.admin_update_profile_access(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.list_public_campaign_cards()
  from public, anon, authenticated;
revoke all on function public.request_campaign_membership(uuid)
  from public, anon, authenticated;
revoke all on function public.get_campaign_chapter_timeline(uuid)
  from public, anon, authenticated;
revoke all on function public.update_character_loadout(
  uuid, text[], text[], text[], smallint
) from public, anon, authenticated;
revoke all on function public.open_virtual_table(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.close_virtual_table(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_update_campaign_session_and_close_table(
  uuid, uuid, smallint, text, text, timestamptz, timestamptz,
  text, text, text, text
) from public, anon, authenticated;
revoke all on function public.activate_virtual_table_map(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.set_virtual_table_map_file(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_virtual_table_map(uuid)
  from public, anon, authenticated;
revoke all on function public.move_virtual_table_token(
  uuid, uuid, double precision, double precision
) from public, anon, authenticated;
revoke all on function public.broadcast_virtual_table_token_preview(
  uuid, uuid, double precision, double precision
) from public, anon, authenticated;
revoke all on function public.roll_virtual_table_dice(uuid, text)
  from public, anon, authenticated;
revoke all on function public.advance_virtual_table_chapter(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.list_public_campaign_cards() to anon, authenticated;
grant execute on function public.get_current_profile() to authenticated;
grant execute on function public.list_campaign_profiles(uuid) to authenticated;
grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.admin_update_profile_access(uuid, text, text)
  to authenticated;
grant execute on function public.request_campaign_membership(uuid) to authenticated;
grant execute on function public.get_campaign_chapter_timeline(uuid) to authenticated;
grant execute on function public.update_character_loadout(
  uuid, text[], text[], text[], smallint
) to authenticated;
grant execute on function public.open_virtual_table(uuid, uuid) to authenticated;
grant execute on function public.close_virtual_table(uuid) to authenticated;
grant execute on function public.admin_update_campaign_session_and_close_table(
  uuid, uuid, smallint, text, text, timestamptz, timestamptz,
  text, text, text, text
) to authenticated;
grant execute on function public.activate_virtual_table_map(uuid, uuid)
  to authenticated;
grant execute on function public.set_virtual_table_map_file(uuid, uuid)
  to authenticated;
grant execute on function public.delete_virtual_table_map(uuid) to authenticated;
grant execute on function public.move_virtual_table_token(
  uuid, uuid, double precision, double precision
) to authenticated;
grant execute on function public.broadcast_virtual_table_token_preview(
  uuid, uuid, double precision, double precision
) to authenticated;
grant execute on function public.roll_virtual_table_dice(uuid, text)
  to authenticated;
grant execute on function public.advance_virtual_table_chapter(
  uuid, uuid, uuid, uuid
) to authenticated;

create policy profiles_select_authorized
on public.profiles
for select
to authenticated
using (
  (select private.current_profile_is_active())
  and (select private.can_view_profile(id))
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  and (select private.current_profile_is_active())
)
with check (
  id = (select auth.uid())
  and status = 'active'
);

create policy campaigns_select_members
on public.campaigns
for select
to authenticated
using ((select private.can_view_campaign(id)));

create policy campaigns_insert_admin
on public.campaigns
for insert
to authenticated
with check ((select private.current_user_is_admin()));

create policy campaigns_update_admin
on public.campaigns
for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy campaigns_delete_admin
on public.campaigns
for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy campaign_members_select_authorized
on public.campaign_members
for select
to authenticated
using (
  (select private.current_profile_is_active())
  and (
    user_id = (select auth.uid())
    or (select private.can_view_campaign(campaign_id))
  )
);

create policy campaign_members_insert_pending_or_admin
on public.campaign_members
for insert
to authenticated
with check (
  (select private.current_user_is_admin())
  or (
    (select private.current_profile_is_active())
    and user_id = (select auth.uid())
    and role = 'player'
    and status = 'pending'
  )
);

create policy campaign_members_update_admin
on public.campaign_members
for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy campaign_members_delete_admin
on public.campaign_members
for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy campaign_chapters_select_progress
on public.campaign_chapters
for select
to authenticated
using (
  (select private.can_manage_campaign(campaign_id))
  or (select private.chapter_is_unlocked(id))
);

create policy campaign_chapters_insert_admin
on public.campaign_chapters
for insert
to authenticated
with check ((select private.current_user_is_admin()));

create policy campaign_chapters_update_admin
on public.campaign_chapters
for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy campaign_chapters_delete_admin
on public.campaign_chapters
for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy character_status_options_select_members
on public.character_status_options
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy character_status_options_write_admin
on public.character_status_options
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy character_class_options_select_members
on public.character_class_options
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy character_class_options_write_admin
on public.character_class_options
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy characters_select_members
on public.characters
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy characters_insert_owner_or_admin
on public.characters
for insert
to authenticated
with check (
  (select private.current_user_is_admin())
  or (
    user_id = (select auth.uid())
    and (select private.can_view_campaign(campaign_id))
  )
);

create policy characters_update_owner_or_admin
on public.characters
for update
to authenticated
using (
  (select private.current_user_is_admin())
  or (
    user_id = (select auth.uid())
    and (select private.can_view_campaign(campaign_id))
  )
)
with check (
  (select private.current_user_is_admin())
  or (
    user_id = (select auth.uid())
    and (select private.can_view_campaign(campaign_id))
  )
);

create policy characters_delete_owner_or_admin
on public.characters
for delete
to authenticated
using (
  (select private.current_user_is_admin())
  or (
    user_id = (select auth.uid())
    and (select private.can_view_campaign(campaign_id))
  )
);

create policy teams_select_members
on public.teams
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy teams_write_admin
on public.teams
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy team_members_select_members
on public.team_members
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy team_members_write_admin
on public.team_members
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy missions_select_members
on public.missions
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy missions_write_admin
on public.missions
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy mission_participants_select_members
on public.mission_participants
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy mission_participants_write_admin
on public.mission_participants
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy campaign_sessions_select_members
on public.campaign_sessions
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy campaign_sessions_insert_admin
on public.campaign_sessions
for insert
to authenticated
with check ((select private.current_user_is_admin()));

create policy campaign_sessions_update_admin
on public.campaign_sessions
for update
to authenticated
using ((select private.current_user_is_admin()))
with check (
  (select private.current_user_is_admin())
  and (
    status = 'scheduled'
    or not exists (
      select 1
      from public.virtual_tables table_session
      where table_session.session_id = campaign_sessions.id
        and table_session.campaign_id = campaign_sessions.campaign_id
        and table_session.status = 'open'
    )
  )
);

create policy campaign_sessions_delete_admin
on public.campaign_sessions
for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy session_participants_select_members
on public.session_participants
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy session_participants_write_admin
on public.session_participants
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy campaign_events_select_members
on public.campaign_events
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy campaign_events_write_admin
on public.campaign_events
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy game_files_select_authorized
on public.game_files
for select
to authenticated
using ((select private.can_read_game_file(id)));

create policy game_files_insert_manager
on public.game_files
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (select private.can_manage_campaign(campaign_id))
);

create policy game_files_update_manager
on public.game_files
for update
to authenticated
using ((select private.can_manage_game_file(id)))
with check (
  (select private.can_manage_campaign(campaign_id))
);

create policy game_files_delete_manager
on public.game_files
for delete
to authenticated
using ((select private.can_manage_game_file(id)));

create policy file_relations_select_authorized
on public.file_relations
for select
to authenticated
using ((select private.can_read_game_file(file_id)));

create policy file_relations_insert_manager
on public.file_relations
for insert
to authenticated
with check ((select private.can_manage_game_file(file_id)));

create policy file_relations_update_manager
on public.file_relations
for update
to authenticated
using ((select private.can_manage_game_file(file_id)))
with check ((select private.can_manage_game_file(file_id)));

create policy file_relations_delete_manager
on public.file_relations
for delete
to authenticated
using ((select private.can_manage_game_file(file_id)));

create policy virtual_table_maps_select_members
on public.virtual_table_maps
for select
to authenticated
using ((select private.can_view_virtual_table_map(id)));

create policy virtual_table_maps_insert_manager
on public.virtual_table_maps
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (select private.can_manage_campaign(campaign_id))
);

create policy virtual_table_maps_update_manager
on public.virtual_table_maps
for update
to authenticated
using ((select private.can_manage_campaign(campaign_id)))
with check ((select private.can_manage_campaign(campaign_id)));

create policy virtual_tables_select_members
on public.virtual_tables
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy chapter_transitions_select_members
on public.chapter_transitions
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

create policy virtual_table_tokens_select_authorized
on public.virtual_table_tokens
for select
to authenticated
using (
  (select private.can_manage_campaign(campaign_id))
  or (
    visible
    and (select private.can_view_campaign(campaign_id))
    and exists (
      select 1
      from public.virtual_tables table_session
      where table_session.id = virtual_table_tokens.table_id
        and table_session.campaign_id = virtual_table_tokens.campaign_id
        and table_session.status = 'open'
        and virtual_table_tokens.map_id
          is not distinct from table_session.active_map_id
    )
  )
);

create policy virtual_table_tokens_insert_manager
on public.virtual_table_tokens
for insert
to authenticated
with check ((select private.can_manage_campaign(campaign_id)));

create policy virtual_table_tokens_update_manager
on public.virtual_table_tokens
for update
to authenticated
using ((select private.can_manage_campaign(campaign_id)))
with check ((select private.can_manage_campaign(campaign_id)));

create policy virtual_table_tokens_delete_manager
on public.virtual_table_tokens
for delete
to authenticated
using ((select private.can_manage_campaign(campaign_id)));

create policy dice_rolls_select_members
on public.dice_rolls
for select
to authenticated
using ((select private.can_view_campaign(campaign_id)));

grant select (
  id,
  name,
  username,
  avatar_url,
  role,
  status,
  created_at,
  updated_at
) on public.profiles to authenticated;
grant update (name, username, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.campaign_members to authenticated;
grant select, insert, update, delete on public.campaign_chapters to authenticated;
grant select, insert, update, delete on public.character_status_options to authenticated;
grant select, insert, update, delete on public.character_class_options to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.missions to authenticated;
grant select, insert, update, delete on public.mission_participants to authenticated;
grant select, insert, update, delete on public.campaign_sessions to authenticated;
grant select, insert, update, delete on public.session_participants to authenticated;
grant select, insert, update, delete on public.campaign_events to authenticated;
grant select, insert, update, delete on public.game_files to authenticated;
grant select, insert, update, delete on public.file_relations to authenticated;
grant select, insert, update on public.virtual_table_maps to authenticated;
grant select on public.virtual_tables to authenticated;
grant select on public.chapter_transitions to authenticated;
grant select, insert, update, delete on public.virtual_table_tokens to authenticated;
grant select on public.dice_rolls to authenticated;

drop policy if exists campaign_media_public_read on storage.objects;
drop policy if exists campaign_media_authenticated_read on storage.objects;
drop policy if exists campaign_media_insert on storage.objects;
drop policy if exists campaign_media_update on storage.objects;
drop policy if exists campaign_media_delete on storage.objects;

create policy campaign_media_public_read
on storage.objects
for select
to anon
using (
  bucket_id = 'campaign-media'
  and (select private.is_public_campaign_media(name))
);

create policy campaign_media_authenticated_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'campaign-media'
  and (
    (
      owner_id = (select auth.uid()::text)
      and (select private.can_upload_campaign_media(name))
      and not (select private.is_referenced_campaign_media(name))
    )
    or (select private.can_read_campaign_media(name))
  )
);

create policy campaign_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'campaign-media'
  and owner_id = (select auth.uid()::text)
  and (select private.can_upload_campaign_media(name))
);

create policy campaign_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'campaign-media'
  and (
    (
      owner_id = (select auth.uid()::text)
      and (select private.can_upload_campaign_media(name))
      and not (select private.is_referenced_campaign_media(name))
    )
    or (select private.can_manage_campaign_media(name))
  )
)
with check (
  bucket_id = 'campaign-media'
  and (select private.can_upload_campaign_media(name))
  and (
    (
      owner_id = (select auth.uid()::text)
      and (select private.can_upload_campaign_media(name))
      and not (select private.is_referenced_campaign_media(name))
    )
    or (select private.can_manage_campaign_media(name))
  )
);

create policy campaign_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'campaign-media'
  and (
    (
      owner_id = (select auth.uid()::text)
      and (select private.can_upload_campaign_media(name))
      and not (select private.is_referenced_campaign_media(name))
    )
    or (select private.can_manage_campaign_media(name))
  )
);

drop policy if exists vtt_members_receive_realtime on realtime.messages;
drop policy if exists vtt_members_send_broadcast on realtime.messages;
drop policy if exists vtt_members_track_presence on realtime.messages;

create policy vtt_members_receive_realtime
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select private.can_access_vtt_topic((select realtime.topic())))
);

create policy vtt_members_track_presence
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select private.can_access_vtt_topic((select realtime.topic())))
);

commit;
