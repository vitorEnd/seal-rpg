-- PostgREST evaluates SELECT policies for rows returned by INSERT ... RETURNING.
-- The general policy delegates to can_read_game_file(id), whose stable lookup
-- cannot see the row inserted by the current statement. Let a campaign manager
-- read an upload they created by evaluating the new row columns directly.
create policy game_files_select_creator_manager
on public.game_files
for select
to authenticated
using (
  created_by_user_id = (select auth.uid())
  and (select private.can_manage_campaign(campaign_id))
);
