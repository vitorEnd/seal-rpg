-- Composite foreign keys need indexes in the same leading-column order.
-- Several single-column indexes already serve common reads; these specifically
-- protect parent updates/deletes and compound joins as the campaign grows.
create index chapter_transitions_from_campaign_fk_idx
  on public.chapter_transitions (from_chapter_id, campaign_id);
create index chapter_transitions_map_campaign_fk_idx
  on public.chapter_transitions (map_id, campaign_id);
create index chapter_transitions_table_campaign_fk_idx
  on public.chapter_transitions (table_id, campaign_id);
create index chapter_transitions_to_campaign_fk_idx
  on public.chapter_transitions (to_chapter_id, campaign_id);

create index characters_class_campaign_fk_idx
  on public.characters (class_option_id, campaign_id);
create index characters_status_campaign_fk_idx
  on public.characters (status_option_id, campaign_id);

create index dice_rolls_table_campaign_session_fk_idx
  on public.dice_rolls (table_id, campaign_id, session_id);
create index file_relations_file_campaign_fk_idx
  on public.file_relations (file_id, campaign_id);

create index mission_participants_character_campaign_fk_idx
  on public.mission_participants (character_id, campaign_id);
create index mission_participants_mission_campaign_fk_idx
  on public.mission_participants (mission_id, campaign_id);
create index session_participants_character_campaign_fk_idx
  on public.session_participants (character_id, campaign_id);
create index session_participants_session_campaign_fk_idx
  on public.session_participants (session_id, campaign_id);
create index team_members_character_campaign_fk_idx
  on public.team_members (character_id, campaign_id);
create index team_members_team_campaign_fk_idx
  on public.team_members (team_id, campaign_id);

create index virtual_table_maps_image_campaign_fk_idx
  on public.virtual_table_maps (image_file_id, campaign_id);
create index virtual_table_tokens_character_campaign_fk_idx
  on public.virtual_table_tokens (character_id, campaign_id);
create index virtual_table_tokens_image_campaign_fk_idx
  on public.virtual_table_tokens (image_file_id, campaign_id);
create index virtual_table_tokens_map_campaign_fk_idx
  on public.virtual_table_tokens (map_id, campaign_id);
create index virtual_table_tokens_table_campaign_fk_idx
  on public.virtual_table_tokens (table_id, campaign_id);
create index virtual_tables_active_map_campaign_fk_idx
  on public.virtual_tables (active_map_id, campaign_id);
create index virtual_tables_map_file_campaign_fk_idx
  on public.virtual_tables (map_file_id, campaign_id);
create index virtual_tables_session_campaign_fk_idx
  on public.virtual_tables (session_id, campaign_id);

-- A FOR ALL admin policy also participates in SELECT, which makes PostgreSQL
-- evaluate it alongside the member read policy. Split writes by command so
-- there is one permissive SELECT path per role/table.
drop policy character_status_options_write_admin
  on public.character_status_options;
create policy character_status_options_insert_admin
  on public.character_status_options for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy character_status_options_update_admin
  on public.character_status_options for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy character_status_options_delete_admin
  on public.character_status_options for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy character_class_options_write_admin
  on public.character_class_options;
create policy character_class_options_insert_admin
  on public.character_class_options for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy character_class_options_update_admin
  on public.character_class_options for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy character_class_options_delete_admin
  on public.character_class_options for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy teams_write_admin on public.teams;
create policy teams_insert_admin
  on public.teams for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy teams_update_admin
  on public.teams for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy teams_delete_admin
  on public.teams for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy team_members_write_admin on public.team_members;
create policy team_members_insert_admin
  on public.team_members for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy team_members_update_admin
  on public.team_members for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy team_members_delete_admin
  on public.team_members for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy missions_write_admin on public.missions;
create policy missions_insert_admin
  on public.missions for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy missions_update_admin
  on public.missions for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy missions_delete_admin
  on public.missions for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy mission_participants_write_admin
  on public.mission_participants;
create policy mission_participants_insert_admin
  on public.mission_participants for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy mission_participants_update_admin
  on public.mission_participants for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy mission_participants_delete_admin
  on public.mission_participants for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy session_participants_write_admin
  on public.session_participants;
create policy session_participants_insert_admin
  on public.session_participants for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy session_participants_update_admin
  on public.session_participants for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy session_participants_delete_admin
  on public.session_participants for delete to authenticated
  using ((select private.current_user_is_admin()));

drop policy campaign_events_write_admin on public.campaign_events;
create policy campaign_events_insert_admin
  on public.campaign_events for insert to authenticated
  with check ((select private.current_user_is_admin()));
create policy campaign_events_update_admin
  on public.campaign_events for update to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));
create policy campaign_events_delete_admin
  on public.campaign_events for delete to authenticated
  using ((select private.current_user_is_admin()));
