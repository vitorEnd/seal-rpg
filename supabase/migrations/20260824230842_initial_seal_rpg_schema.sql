begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema private
  revoke execute on functions from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  username text not null check (username ~ '^[a-z0-9_]{3,24}$'),
  email text not null,
  avatar_url text,
  role text not null default 'player'
    check (role in ('admin', 'game_master', 'player')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_key on public.profiles (lower(username));
create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_status_idx on public.profiles (role, status);

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_name text;
begin
  if new.email is null then
    raise exception using
      errcode = '23502',
      message = 'SEAL RPG requires an email address for every authenticated user.';
  end if;

  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    requested_username := 'operator_' || left(replace(new.id::text, '-', ''), 12);
  end if;
  if char_length(requested_name) < 2 then
    requested_name := requested_username;
  end if;

  insert into public.profiles (id, name, username, email)
  values (new.id, left(requested_name, 80), requested_username, lower(new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    if new.email is null then
      raise exception using
        errcode = '23502',
        message = 'SEAL RPG requires an email address for every authenticated user.';
    end if;

    update public.profiles
    set email = lower(new.email)
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function private.sync_auth_user_email();

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null check (char_length(short_description) between 10 and 220),
  description text not null check (char_length(description) between 30 and 5000),
  setting text not null check (char_length(setting) between 3 and 180),
  genre text not null check (char_length(genre) between 2 and 80),
  status text not null check (status in ('draft', 'recruiting', 'active', 'paused', 'completed')),
  cover_image_url text,
  cover_image_storage_key text,
  background_image_url text,
  background_image_storage_key text,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  start_date timestamptz,
  game_master_user_id uuid references public.profiles (id) on delete set null,
  story_summary text not null default '' check (char_length(story_summary) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_slug_key unique (slug),
  constraint campaigns_cover_storage_key_key unique (cover_image_storage_key),
  constraint campaigns_background_storage_key_key unique (background_image_storage_key)
);

create index campaigns_game_master_user_id_idx on public.campaigns (game_master_user_id);
create index campaigns_status_updated_at_idx on public.campaigns (status, updated_at desc);

create table public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('game_master', 'player')),
  status text not null check (status in ('pending', 'approved', 'rejected', 'removed')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_members_campaign_user_key unique (campaign_id, user_id)
);

create index campaign_members_user_status_idx on public.campaign_members (user_id, status);
create index campaign_members_campaign_status_role_idx on public.campaign_members (campaign_id, status, role);

create table public.campaign_chapters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null check (char_length(short_description) between 10 and 240),
  description text not null check (char_length(description) between 10 and 4000),
  background_image_url text,
  background_image_storage_key text,
  sort_order smallint not null check (sort_order between 1 and 999),
  status text not null check (status in ('draft', 'published')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_chapters_campaign_slug_key unique (campaign_id, slug),
  constraint campaign_chapters_background_storage_key_key unique (background_image_storage_key),
  constraint campaign_chapters_id_campaign_key unique (id, campaign_id)
);

create index campaign_chapters_campaign_progress_idx
  on public.campaign_chapters (campaign_id, status, completed_at, sort_order, title, id);

create table public.character_status_options (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order smallint not null check (sort_order between 1 and 999),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_status_options_campaign_slug_key unique (campaign_id, slug),
  constraint character_status_options_id_campaign_key unique (id, campaign_id)
);

create index character_status_options_campaign_order_idx
  on public.character_status_options (campaign_id, sort_order, name);

create table public.character_class_options (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 500),
  logo_image_url text,
  logo_image_storage_key text,
  bonus_physical smallint not null default 0 check (bonus_physical between 0 and 5),
  bonus_agility smallint not null default 0 check (bonus_agility between 0 and 5),
  bonus_marksmanship smallint not null default 0 check (bonus_marksmanship between 0 and 5),
  bonus_perception smallint not null default 0 check (bonus_perception between 0 and 5),
  bonus_technique smallint not null default 0 check (bonus_technique between 0 and 5),
  bonus_control smallint not null default 0 check (bonus_control between 0 and 5),
  sort_order smallint not null check (sort_order between 1 and 999),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_class_options_campaign_slug_key unique (campaign_id, slug),
  constraint character_class_options_logo_storage_key_key unique (logo_image_storage_key),
  constraint character_class_options_id_campaign_key unique (id, campaign_id)
);

create index character_class_options_campaign_order_idx
  on public.character_class_options (campaign_id, sort_order, name);

create or replace function private.text_array_items_are_valid(
  values_to_check text[],
  maximum_length integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(
      item is not null
      and char_length(trim(item)) between 1 and maximum_length
    ),
    true
  )
  from unnest(values_to_check) item;
$$;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null check (char_length(short_description) between 10 and 220),
  description text not null check (char_length(description) between 10 and 5000),
  gender text not null check (char_length(gender) between 1 and 80),
  status_option_id uuid not null,
  class_option_id uuid not null,
  attribute_physical smallint not null check (attribute_physical between 0 and 5),
  attribute_agility smallint not null check (attribute_agility between 0 and 5),
  attribute_marksmanship smallint not null check (attribute_marksmanship between 0 and 5),
  attribute_perception smallint not null check (attribute_perception between 0 and 5),
  attribute_technique smallint not null check (attribute_technique between 0 and 5),
  attribute_control smallint not null check (attribute_control between 0 and 5),
  cover_image_url text,
  cover_image_storage_key text,
  background_image_url text,
  background_image_storage_key text,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  start_date timestamptz,
  equipment text[] not null default array[]::text[],
  wounds text[] not null default array[]::text[],
  backpack_items text[] not null default array[]::text[],
  inventory_slots smallint not null default 8 check (inventory_slots between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_campaign_slug_key unique (campaign_id, slug),
  constraint characters_attribute_budget_check check (
    attribute_physical + attribute_agility + attribute_marksmanship +
    attribute_perception + attribute_technique + attribute_control = 8
  ),
  constraint characters_equipment_limit_check check (
    cardinality(equipment) <= 30
    and private.text_array_items_are_valid(equipment, 120)
  ),
  constraint characters_wounds_limit_check check (
    cardinality(wounds) <= 30
    and private.text_array_items_are_valid(wounds, 180)
  ),
  constraint characters_backpack_limit_check check (
    cardinality(backpack_items) <= 40
    and private.text_array_items_are_valid(backpack_items, 120)
  ),
  constraint characters_backpack_slots_check check (
    cardinality(backpack_items) <= inventory_slots
  ),
  constraint characters_cover_storage_key_key unique (cover_image_storage_key),
  constraint characters_background_storage_key_key unique (background_image_storage_key),
  constraint characters_id_campaign_key unique (id, campaign_id),
  constraint characters_status_option_campaign_fkey foreign key (
    status_option_id,
    campaign_id
  ) references public.character_status_options (id, campaign_id)
    on delete no action deferrable initially deferred,
  constraint characters_class_option_campaign_fkey foreign key (
    class_option_id,
    campaign_id
  ) references public.character_class_options (id, campaign_id)
    on delete no action deferrable initially deferred
);

create index characters_campaign_name_idx on public.characters (campaign_id, name);
create index characters_campaign_user_idx on public.characters (campaign_id, user_id);
create index characters_user_id_idx on public.characters (user_id);
create index characters_status_option_id_idx on public.characters (status_option_id);
create index characters_class_option_id_idx on public.characters (class_option_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  image_url text,
  sort_order smallint not null check (sort_order between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_id_campaign_key unique (id, campaign_id)
);

create index teams_campaign_order_idx on public.teams (campaign_id, sort_order, name);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  team_id uuid not null,
  character_id uuid not null,
  sort_order smallint not null default 1 check (sort_order between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_team_character_key unique (team_id, character_id),
  constraint team_members_team_campaign_fkey foreign key (team_id, campaign_id)
    references public.teams (id, campaign_id) on delete cascade,
  constraint team_members_character_campaign_fkey foreign key (
    character_id,
    campaign_id
  ) references public.characters (id, campaign_id) on delete cascade
);

create index team_members_campaign_id_idx on public.team_members (campaign_id);
create index team_members_character_id_idx on public.team_members (character_id);
create index team_members_team_order_idx on public.team_members (team_id, sort_order);

create or replace function private.set_team_member_campaign_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_campaign_id uuid;
begin
  select team.campaign_id
  into parent_campaign_id
  from public.teams as team
  where team.id = new.team_id;

  if parent_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected team does not exist.';
  end if;
  if new.campaign_id is not null and new.campaign_id <> parent_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The team member campaign must match the team campaign.';
  end if;

  new.campaign_id := parent_campaign_id;
  return new;
end;
$$;

create trigger team_members_set_campaign_id
before insert or update of campaign_id, team_id, character_id
on public.team_members
for each row execute function private.set_team_member_campaign_id();

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  mission_number smallint not null check (mission_number between 1 and 9999),
  image_url text,
  description text not null default '' check (char_length(description) <= 5000),
  briefing text not null default '' check (char_length(briefing) <= 5000),
  primary_objective text not null default '' check (char_length(primary_objective) <= 2000),
  secondary_objectives text[] not null default array[]::text[],
  status text not null check (status in ('locked', 'available', 'in_progress', 'completed', 'failed')),
  scheduled_at timestamptz,
  result text not null default '' check (char_length(result) <= 5000),
  notes text not null default '' check (char_length(notes) <= 5000),
  sort_order smallint not null check (sort_order between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_campaign_number_key unique (campaign_id, mission_number),
  constraint missions_id_campaign_key unique (id, campaign_id)
);

create index missions_campaign_order_idx on public.missions (campaign_id, sort_order, mission_number);

create table public.mission_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  mission_id uuid not null,
  character_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_participants_mission_character_key unique (mission_id, character_id),
  constraint mission_participants_mission_campaign_fkey foreign key (
    mission_id,
    campaign_id
  ) references public.missions (id, campaign_id) on delete cascade,
  constraint mission_participants_character_campaign_fkey foreign key (
    character_id,
    campaign_id
  ) references public.characters (id, campaign_id) on delete cascade
);

create index mission_participants_campaign_id_idx
  on public.mission_participants (campaign_id);
create index mission_participants_character_id_idx on public.mission_participants (character_id);

create or replace function private.set_mission_participant_campaign_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_campaign_id uuid;
begin
  select mission.campaign_id
  into parent_campaign_id
  from public.missions as mission
  where mission.id = new.mission_id;

  if parent_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected mission does not exist.';
  end if;
  if new.campaign_id is not null and new.campaign_id <> parent_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The mission participant campaign must match the mission campaign.';
  end if;

  new.campaign_id := parent_campaign_id;
  return new;
end;
$$;

create trigger mission_participants_set_campaign_id
before insert or update of campaign_id, mission_id, character_id
on public.mission_participants
for each row execute function private.set_mission_participant_campaign_id();

create table public.campaign_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_number smallint not null check (session_number between 1 and 9999),
  title text not null check (char_length(title) between 2 and 120),
  status text not null check (status in ('scheduled', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  occurred_at timestamptz,
  summary text not null default '' check (char_length(summary) <= 2500),
  description text not null default '' check (char_length(description) <= 5000),
  events text not null default '' check (char_length(events) <= 5000),
  consequences text not null default '' check (char_length(consequences) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_sessions_campaign_number_key unique (campaign_id, session_number),
  constraint campaign_sessions_id_campaign_key unique (id, campaign_id),
  constraint campaign_sessions_schedule_check check (
    status <> 'scheduled' or scheduled_at is not null
  ),
  constraint campaign_sessions_completion_check check (
    status <> 'completed' or occurred_at is not null
  )
);

create index campaign_sessions_campaign_timeline_idx
  on public.campaign_sessions (campaign_id, status, scheduled_at desc, occurred_at desc);

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid not null,
  character_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_participants_session_character_key unique (session_id, character_id),
  constraint session_participants_session_campaign_fkey foreign key (
    session_id,
    campaign_id
  ) references public.campaign_sessions (id, campaign_id) on delete cascade,
  constraint session_participants_character_campaign_fkey foreign key (
    character_id,
    campaign_id
  ) references public.characters (id, campaign_id) on delete cascade
);

create index session_participants_campaign_id_idx
  on public.session_participants (campaign_id);
create index session_participants_character_id_idx on public.session_participants (character_id);

create or replace function private.set_session_participant_campaign_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_campaign_id uuid;
begin
  select campaign_session.campaign_id
  into parent_campaign_id
  from public.campaign_sessions as campaign_session
  where campaign_session.id = new.session_id;

  if parent_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected session does not exist.';
  end if;
  if new.campaign_id is not null and new.campaign_id <> parent_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The session participant campaign must match the session campaign.';
  end if;

  new.campaign_id := parent_campaign_id;
  return new;
end;
$$;

create trigger session_participants_set_campaign_id
before insert or update of campaign_id, session_id, character_id
on public.session_participants
for each row execute function private.set_session_participant_campaign_id();

create table public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  occurred_at timestamptz not null,
  type text not null check (type in (
    'mission_started', 'mission_completed', 'character_injured',
    'character_deceased', 'location_discovered', 'document_found',
    'narrative', 'other'
  )),
  image_url text,
  sort_order smallint not null check (sort_order between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_events_campaign_timeline_idx
  on public.campaign_events (campaign_id, sort_order, occurred_at);

create table public.game_files (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null check (category in ('intel', 'map', 'briefing', 'report', 'image', 'other')),
  visibility text not null check (visibility in ('public', 'members', 'game_master', 'admin')),
  storage_key text,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 6291456),
  created_by_user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_files_storage_key_key unique (storage_key),
  constraint game_files_id_campaign_key unique (id, campaign_id)
);

create index game_files_campaign_updated_idx on public.game_files (campaign_id, updated_at desc);
create index game_files_campaign_visibility_idx on public.game_files (campaign_id, visibility);
create index game_files_created_by_user_id_idx on public.game_files (created_by_user_id);

create table public.file_relations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  file_id uuid not null,
  relation_type text not null check (relation_type in ('mission', 'session', 'character')),
  relation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint file_relations_target_key unique (file_id, relation_type, relation_id),
  constraint file_relations_file_campaign_fkey foreign key (file_id, campaign_id)
    references public.game_files (id, campaign_id) on delete cascade
);

create index file_relations_campaign_id_idx on public.file_relations (campaign_id);
create index file_relations_target_idx on public.file_relations (relation_type, relation_id);

create or replace function private.validate_file_relation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_campaign_id uuid;
  target_campaign_id uuid;
begin
  select game_file.campaign_id
  into file_campaign_id
  from public.game_files as game_file
  where game_file.id = new.file_id;

  if file_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected file does not exist.';
  end if;
  if new.campaign_id is not null and new.campaign_id <> file_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The file relation campaign must match the file campaign.';
  end if;

  target_campaign_id := null;
  case new.relation_type
    when 'mission' then
      select mission.campaign_id
      into target_campaign_id
      from public.missions as mission
      where mission.id = new.relation_id
      for key share;
    when 'session' then
      select campaign_session.campaign_id
      into target_campaign_id
      from public.campaign_sessions as campaign_session
      where campaign_session.id = new.relation_id
      for key share;
    when 'character' then
      select character.campaign_id
      into target_campaign_id
      from public.characters as character
      where character.id = new.relation_id
      for key share;
  end case;

  if target_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected file relation target does not exist.';
  end if;
  if target_campaign_id <> file_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The file and its relation target must belong to the same campaign.';
  end if;

  new.campaign_id := file_campaign_id;
  return new;
end;
$$;

create trigger file_relations_validate_target
before insert or update of campaign_id, file_id, relation_type, relation_id
on public.file_relations
for each row execute function private.validate_file_relation();

create or replace function private.delete_file_relations_for_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.file_relations
  where relation_type = tg_argv[0]
    and relation_id = old.id
    and campaign_id = old.campaign_id;
  return old;
end;
$$;

create or replace function private.prevent_file_relation_target_key_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.id is distinct from old.id or
    new.campaign_id is distinct from old.campaign_id
  ) and exists (
    select 1
    from public.file_relations
    where relation_type = tg_argv[0]
      and relation_id = old.id
      and campaign_id = old.campaign_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A file relation target cannot change its identity or campaign while linked.';
  end if;
  return new;
end;
$$;

create trigger missions_protect_file_relation_target
before update of id, campaign_id on public.missions
for each row execute function private.prevent_file_relation_target_key_change('mission');

create trigger sessions_protect_file_relation_target
before update of id, campaign_id on public.campaign_sessions
for each row execute function private.prevent_file_relation_target_key_change('session');

create trigger characters_protect_file_relation_target
before update of id, campaign_id on public.characters
for each row execute function private.prevent_file_relation_target_key_change('character');

create trigger missions_delete_file_relations
after delete on public.missions
for each row execute function private.delete_file_relations_for_target('mission');

create trigger sessions_delete_file_relations
after delete on public.campaign_sessions
for each row execute function private.delete_file_relations_for_target('session');

create trigger characters_delete_file_relations
after delete on public.characters
for each row execute function private.delete_file_relations_for_target('character');

create table public.virtual_table_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  group_name text not null check (char_length(group_name) between 1 and 120),
  layer_name text not null check (char_length(layer_name) between 1 and 120),
  image_file_id uuid,
  built_in_image_url text,
  scale text not null check (scale in ('medium', 'large', 'huge')),
  built_in boolean not null default false,
  sort_order smallint not null check (sort_order between 1 and 999),
  created_by_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint virtual_table_maps_image_source_check check (
    image_file_id is not null or built_in_image_url is not null
  ),
  constraint virtual_table_maps_id_campaign_key unique (id, campaign_id),
  constraint virtual_table_maps_image_file_campaign_fkey foreign key (
    image_file_id,
    campaign_id
  ) references public.game_files (id, campaign_id)
    on delete no action deferrable initially deferred
);

create index virtual_table_maps_campaign_order_idx
  on public.virtual_table_maps (campaign_id, sort_order, group_name, layer_name);
create index virtual_table_maps_image_file_id_idx on public.virtual_table_maps (image_file_id);
create index virtual_table_maps_created_by_user_id_idx on public.virtual_table_maps (created_by_user_id);

create table public.virtual_tables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid not null,
  status text not null check (status in ('open', 'closed')),
  map_file_id uuid,
  active_map_id uuid,
  revision bigint not null default 1 check (revision >= 1),
  opened_by_user_id uuid not null references public.profiles (id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint virtual_tables_session_key unique (session_id),
  constraint virtual_tables_id_campaign_key unique (id, campaign_id),
  constraint virtual_tables_id_campaign_session_key unique (id, campaign_id, session_id),
  constraint virtual_tables_closed_at_check check (
    (status = 'open' and closed_at is null) or
    (status = 'closed' and closed_at is not null)
  ),
  constraint virtual_tables_session_campaign_fkey foreign key (
    session_id,
    campaign_id
  ) references public.campaign_sessions (id, campaign_id) on delete cascade,
  constraint virtual_tables_map_file_campaign_fkey foreign key (
    map_file_id,
    campaign_id
  ) references public.game_files (id, campaign_id)
    on delete no action deferrable initially deferred,
  constraint virtual_tables_active_map_campaign_fkey foreign key (
    active_map_id,
    campaign_id
  ) references public.virtual_table_maps (id, campaign_id)
    on delete set null (active_map_id)
);

create unique index virtual_tables_one_open_per_campaign_idx
  on public.virtual_tables (campaign_id) where status = 'open';
create index virtual_tables_campaign_opened_idx on public.virtual_tables (campaign_id, opened_at desc);
create index virtual_tables_active_map_id_idx on public.virtual_tables (active_map_id);
create index virtual_tables_map_file_id_idx on public.virtual_tables (map_file_id);
create index virtual_tables_opened_by_user_id_idx on public.virtual_tables (opened_by_user_id);

create table public.chapter_transitions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  table_id uuid not null,
  from_chapter_id uuid not null,
  to_chapter_id uuid,
  map_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapter_transitions_table_campaign_fkey foreign key (
    table_id,
    campaign_id
  ) references public.virtual_tables (id, campaign_id) on delete cascade,
  constraint chapter_transitions_from_chapter_campaign_fkey foreign key (
    from_chapter_id,
    campaign_id
  ) references public.campaign_chapters (id, campaign_id) on delete cascade,
  constraint chapter_transitions_to_chapter_campaign_fkey foreign key (
    to_chapter_id,
    campaign_id
  ) references public.campaign_chapters (id, campaign_id) on delete cascade,
  constraint chapter_transitions_map_campaign_fkey foreign key (
    map_id,
    campaign_id
  ) references public.virtual_table_maps (id, campaign_id)
    on delete set null (map_id)
);

create index chapter_transitions_campaign_id_idx on public.chapter_transitions (campaign_id);
create index chapter_transitions_table_occurred_idx
  on public.chapter_transitions (table_id, occurred_at desc, id desc);
create index chapter_transitions_from_chapter_id_idx on public.chapter_transitions (from_chapter_id);
create index chapter_transitions_to_chapter_id_idx on public.chapter_transitions (to_chapter_id);
create index chapter_transitions_map_id_idx on public.chapter_transitions (map_id);

create or replace function private.set_chapter_transition_campaign_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_campaign_id uuid;
begin
  select virtual_table.campaign_id
  into parent_campaign_id
  from public.virtual_tables as virtual_table
  where virtual_table.id = new.table_id;

  if parent_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected virtual table does not exist.';
  end if;
  if new.campaign_id is not null and new.campaign_id <> parent_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The chapter transition campaign must match the table campaign.';
  end if;

  new.campaign_id := parent_campaign_id;
  return new;
end;
$$;

create trigger chapter_transitions_set_campaign_id
before insert or update of campaign_id, table_id, from_chapter_id, to_chapter_id, map_id
on public.chapter_transitions
for each row execute function private.set_chapter_transition_campaign_id();

create table public.virtual_table_tokens (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  table_id uuid not null,
  map_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('character', 'npc', 'enemy', 'object')),
  character_id uuid,
  image_file_id uuid,
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  size double precision not null check (size between 0.01 and 0.12),
  z_index integer not null default 1 check (z_index >= 0),
  visible boolean not null default true,
  disposition text not null check (disposition in ('player', 'ally', 'neutral', 'hostile', 'object')),
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  notes text not null default '' check (char_length(notes) <= 1200),
  collectible boolean not null default false,
  rotation smallint not null default 0 check (rotation between 0 and 359),
  vision_enabled boolean not null default true,
  vision_angle smallint not null default 70 check (vision_angle between 10 and 180),
  vision_range double precision not null default 0.22 check (vision_range between 0.05 and 0.6),
  vision_color text not null check (vision_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint virtual_table_tokens_kind_character_check check (
    (kind = 'character' and character_id is not null) or
    (kind <> 'character' and character_id is null)
  ),
  constraint virtual_table_tokens_table_campaign_fkey foreign key (
    table_id,
    campaign_id
  ) references public.virtual_tables (id, campaign_id) on delete cascade,
  constraint virtual_table_tokens_map_campaign_fkey foreign key (
    map_id,
    campaign_id
  ) references public.virtual_table_maps (id, campaign_id)
    on delete no action deferrable initially deferred,
  constraint virtual_table_tokens_character_campaign_fkey foreign key (
    character_id,
    campaign_id
  ) references public.characters (id, campaign_id) on delete cascade,
  constraint virtual_table_tokens_image_file_campaign_fkey foreign key (
    image_file_id,
    campaign_id
  ) references public.game_files (id, campaign_id)
    on delete set null (image_file_id)
);

create index virtual_table_tokens_campaign_id_idx
  on public.virtual_table_tokens (campaign_id);
create unique index virtual_table_tokens_character_once_idx
  on public.virtual_table_tokens (table_id, character_id)
  where character_id is not null;
create index virtual_table_tokens_table_map_order_idx
  on public.virtual_table_tokens (table_id, map_id, z_index, created_at);
create index virtual_table_tokens_map_id_idx on public.virtual_table_tokens (map_id);
create index virtual_table_tokens_character_id_idx on public.virtual_table_tokens (character_id);
create index virtual_table_tokens_image_file_id_idx on public.virtual_table_tokens (image_file_id);

create or replace function private.set_virtual_table_token_campaign_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_campaign_id uuid;
begin
  select virtual_table.campaign_id
  into parent_campaign_id
  from public.virtual_tables as virtual_table
  where virtual_table.id = new.table_id;

  if parent_campaign_id is null then
    raise exception using
      errcode = '23503',
      message = 'The selected virtual table does not exist.';
  end if;
  if new.campaign_id is not null and new.campaign_id <> parent_campaign_id then
    raise exception using
      errcode = '23514',
      message = 'The token campaign must match the table campaign.';
  end if;

  new.campaign_id := parent_campaign_id;
  return new;
end;
$$;

create trigger virtual_table_tokens_set_campaign_id
before insert or update of campaign_id, table_id, map_id, character_id, image_file_id
on public.virtual_table_tokens
for each row execute function private.set_virtual_table_token_campaign_id();

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_name text not null check (char_length(actor_name) between 1 and 80),
  expression text not null check (char_length(expression) between 3 and 20),
  dice_values smallint[] not null,
  modifier smallint not null check (modifier between -100 and 100),
  total integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dice_rolls_values_check check (
    cardinality(dice_values) between 1 and 20 and
    0 < all(dice_values) and
    100 >= all(dice_values)
  ),
  constraint dice_rolls_table_campaign_session_fkey foreign key (
    table_id,
    campaign_id,
    session_id
  ) references public.virtual_tables (id, campaign_id, session_id) on delete cascade
);

create index dice_rolls_table_created_idx on public.dice_rolls (table_id, created_at desc, id desc);
create index dice_rolls_user_id_idx on public.dice_rolls (user_id);
create index dice_rolls_campaign_id_idx on public.dice_rolls (campaign_id);
create index dice_rolls_session_id_idx on public.dice_rolls (session_id);

create or replace function private.validate_dice_roll()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expression_parts text[];
  expected_count integer;
  expected_sides integer;
  expected_modifier integer;
  expected_total integer;
begin
  expression_parts := pg_catalog.regexp_match(
    new.expression,
    '^([1-9]|1[0-9]|20)d(4|6|8|10|12|20|100)([+-]([1-9][0-9]?|100))?$'
  );

  if expression_parts is null then
    raise exception using
      errcode = '23514',
      message = 'The dice expression is invalid.';
  end if;

  expected_count := expression_parts[1]::integer;
  expected_sides := expression_parts[2]::integer;
  expected_modifier := coalesce(expression_parts[3]::integer, 0);

  if cardinality(new.dice_values) <> expected_count then
    raise exception using
      errcode = '23514',
      message = 'The number of dice values does not match the expression.';
  end if;
  if new.modifier <> expected_modifier then
    raise exception using
      errcode = '23514',
      message = 'The dice modifier does not match the expression.';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(new.dice_values) as values_table(rolled_value)
    where rolled_value is null
      or rolled_value < 1
      or rolled_value > expected_sides
  ) then
    raise exception using
      errcode = '23514',
      message = 'A die result is outside the range allowed by the expression.';
  end if;

  select coalesce(sum(rolled_value), 0)::integer + new.modifier
  into expected_total
  from pg_catalog.unnest(new.dice_values) as values_table(rolled_value);

  if new.total <> expected_total then
    raise exception using
      errcode = '23514',
      message = 'The dice total does not match the recorded values.';
  end if;

  return new;
end;
$$;

create trigger dice_rolls_validate_result
before insert or update of table_id, campaign_id, session_id, expression, dice_values, modifier, total
on public.dice_rolls
for each row execute function private.validate_dice_roll();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'campaigns', 'campaign_members', 'campaign_chapters',
    'character_status_options', 'character_class_options', 'characters',
    'teams', 'team_members', 'missions', 'mission_participants',
    'campaign_sessions', 'session_participants', 'campaign_events',
    'game_files', 'file_relations', 'virtual_table_maps', 'virtual_tables',
    'chapter_transitions', 'virtual_table_tokens', 'dice_rolls'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'campaign-media',
  'campaign-media',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

commit;
