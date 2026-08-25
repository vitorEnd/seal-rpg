begin;

do $$
declare
  target_admin_id uuid;
  target_campaign_id uuid;
begin
  select profile.id
  into strict target_admin_id
  from public.profiles profile
  where lower(profile.email) = lower('vitormonzoleme@gmail.com')
    and profile.role = 'admin'
    and profile.status = 'active';

  select campaign.id
  into strict target_campaign_id
  from public.campaigns campaign
  where campaign.slug = 'operacao-neptune';

  update public.campaigns
  set game_master_user_id = target_admin_id
  where id = target_campaign_id
    and game_master_user_id is distinct from target_admin_id;

  insert into public.campaign_members (
    campaign_id,
    user_id,
    role,
    status
  ) values (
    target_campaign_id,
    target_admin_id,
    'game_master',
    'approved'
  )
  on conflict (campaign_id, user_id) do update
  set role = 'game_master',
      status = 'approved';
end;
$$;

commit;
