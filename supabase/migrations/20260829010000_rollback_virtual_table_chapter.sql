create or replace function public.rollback_virtual_table_chapter(
  target_table_id uuid,
  expected_current_chapter_id uuid,
  expected_previous_chapter_id uuid
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
  previous_chapter public.campaign_chapters%rowtype;
  current_chapter_id uuid;
  has_current_chapter boolean;
  has_previous_chapter boolean;
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
    raise exception using errcode = '42501', message = 'CHAPTER_ROLLBACK_DENIED';
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
  has_current_chapter := found;
  current_chapter_id := case
    when has_current_chapter then current_chapter.id
    else null
  end;

  if current_chapter_id is distinct from expected_current_chapter_id then
    raise exception using errcode = '40001', message = 'CURRENT_CHAPTER_CHANGED';
  end if;

  if has_current_chapter then
    select chapter.*
    into previous_chapter
    from public.campaign_chapters chapter
    where chapter.campaign_id = table_session.campaign_id
      and chapter.status = 'published'
      and (
        chapter.sort_order,
        chapter.title,
        chapter.id
      ) < (
        current_chapter.sort_order,
        current_chapter.title,
        current_chapter.id
      )
    order by chapter.sort_order desc, chapter.title desc, chapter.id desc
    limit 1
    for update;
    has_previous_chapter := found;
  else
    select chapter.*
    into previous_chapter
    from public.campaign_chapters chapter
    where chapter.campaign_id = table_session.campaign_id
      and chapter.status = 'published'
    order by chapter.sort_order desc, chapter.title desc, chapter.id desc
    limit 1
    for update;
    has_previous_chapter := found;
  end if;

  if not has_previous_chapter or previous_chapter.completed_at is null then
    raise exception using errcode = 'P0002', message = 'NO_PREVIOUS_COMPLETED_CHAPTER';
  end if;
  if previous_chapter.id is distinct from expected_previous_chapter_id then
    raise exception using errcode = '40001', message = 'PREVIOUS_CHAPTER_CHANGED';
  end if;

  update public.campaign_chapters
  set completed_at = null
  where id = previous_chapter.id
    and campaign_id = table_session.campaign_id
    and status = 'published'
    and completed_at is not null
  returning * into previous_chapter;
  if not found then
    raise exception using errcode = '40001', message = 'PREVIOUS_CHAPTER_CHANGED';
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
    coalesce(current_chapter_id, previous_chapter.id),
    previous_chapter.id,
    table_session.active_map_id,
    operation_time
  )
  returning id into transition_id;

  update public.virtual_tables
  set revision = revision + 1
  where id = table_session.id
    and status = 'open'
  returning * into table_session;
  if not found then
    raise exception using errcode = '40001', message = 'TABLE_STATE_CHANGED';
  end if;

  return jsonb_build_object(
    'table', to_jsonb(table_session),
    'restoredChapter', to_jsonb(previous_chapter),
    'formerCurrentChapter', case
      when has_current_chapter then to_jsonb(current_chapter)
      else null
    end,
    'transitionId', transition_id,
    'occurredAt', operation_time
  );
end;
$$;

revoke all on function public.rollback_virtual_table_chapter(
  uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.rollback_virtual_table_chapter(
  uuid, uuid, uuid
) to authenticated;
