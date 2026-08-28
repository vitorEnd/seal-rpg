begin;

do $$
declare
  target_campaign_id uuid;
begin
  select id
    into target_campaign_id
    from public.campaigns
   where slug = 'operacao-neptune';

  if target_campaign_id is null then
    raise exception 'Campaign operacao-neptune was not found';
  end if;

  insert into public.virtual_table_maps (
    id,
    campaign_id,
    name,
    description,
    group_name,
    layer_name,
    image_file_id,
    built_in_image_url,
    scale,
    built_in,
    sort_order,
    created_by_user_id
  )
  values
    (
      '12000000-0000-4000-8000-000000000013',
      target_campaign_id,
      'Operação Super Bowl — exterior do distrito',
      'Ruas cobertas de neve, barricadas, torcedores, polícia e o acesso principal à torre.',
      'Operação Super Bowl',
      'Exterior / distrito',
      null,
      '/art/maps/neptune-superbowl-district-exterior.png',
      'huge',
      true,
      70,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000014',
      target_campaign_id,
      'Operação Super Bowl — estacionamento subterrâneo',
      'Garagem, docas, elevadores de serviço, depósitos e rotas usadas pelo mensageiro.',
      'Operação Super Bowl',
      'Estacionamento subterrâneo',
      null,
      '/art/maps/neptune-superbowl-underground-parking.png',
      'large',
      true,
      71,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000015',
      target_campaign_id,
      'Operação Super Bowl — centro de convenções',
      'Lobby, evento privado, restaurantes e corredores onde civis e suspeitos se misturam.',
      'Operação Super Bowl',
      'Centro de convenções / térreo',
      null,
      '/art/maps/neptune-superbowl-convention-ground-floor.png',
      'huge',
      true,
      72,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000016',
      target_campaign_id,
      'Operação Super Bowl — andares corporativos',
      'Escritórios, reuniões, servidores, arquivos e segurança privada no coração da investigação.',
      'Operação Super Bowl',
      'Andares corporativos',
      null,
      '/art/maps/neptune-superbowl-corporate-floors.png',
      'large',
      true,
      73,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000017',
      target_campaign_id,
      'Operação Super Bowl — setor restrito',
      'Laboratório clandestino com contenção, cofres e equipamentos experimentais.',
      'Operação Super Bowl',
      'Setor restrito',
      null,
      '/art/maps/neptune-superbowl-restricted-sector.png',
      'large',
      true,
      74,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000018',
      target_campaign_id,
      'Operação Super Bowl — andar executivo e cobertura',
      'Salão panorâmico, suíte executiva, heliponto e estruturas de manutenção para o confronto final.',
      'Operação Super Bowl',
      'Andar executivo / cobertura',
      null,
      '/art/maps/neptune-superbowl-executive-rooftop.png',
      'large',
      true,
      75,
      null
    )
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      name = excluded.name,
      description = excluded.description,
      group_name = excluded.group_name,
      layer_name = excluded.layer_name,
      built_in_image_url = excluded.built_in_image_url,
      scale = excluded.scale,
      built_in = excluded.built_in,
      sort_order = excluded.sort_order,
      updated_at = now();
end;
$$;

commit;
