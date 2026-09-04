begin;

do $$
declare
  target_campaign_id uuid;
begin
  select id
    into target_campaign_id
    from public.campaigns
   where slug = 'sgio-soldados-fantasmas';

  if target_campaign_id is null then
    raise exception 'Campaign sgio-soldados-fantasmas was not found';
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
      '12000000-0000-4000-8000-000000000101',
      target_campaign_id,
      'Base Principal da S.G.I.O.',
      'Instalação subterrânea brutalista e futurista com comando, convivência, alojamentos, enfermaria e elevadores.',
      'Ato 1 — S.G.I.O.',
      'Base principal',
      null,
      '/art/maps/sgio-main-base.png',
      'huge',
      true,
      10,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000102',
      target_campaign_id,
      'Arena de Treinamento da S.G.I.O.',
      'Arena modular preparada para capacidades sobre-humanas, com obstáculos, alvos holográficos e galeria de observação.',
      'Ato 1 — S.G.I.O.',
      'Arena de treinamento',
      null,
      '/art/maps/sgio-training-arena.png',
      'large',
      true,
      20,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000103',
      target_campaign_id,
      'Laboratório de Nathan Voss',
      'Oficina avançada repleta de protótipos, braços robóticos e armaduras experimentais iluminadas em violeta.',
      'Ato 1 — S.G.I.O.',
      'Laboratório de Voss',
      null,
      '/art/maps/sgio-voss-laboratory.png',
      'medium',
      true,
      30,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000104',
      target_campaign_id,
      'Safehouse da S.G.I.O.',
      'Prédio escocês discreto adaptado com comunicações, equipamentos portáteis e pequenas áreas de descanso.',
      'Ato 2 — Escócia',
      'Safehouse',
      null,
      '/art/maps/sgio-scotland-safehouse.png',
      'medium',
      true,
      40,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000105',
      target_campaign_id,
      'Bar Escocês',
      'Pub tradicional de madeira escura, iluminação quente e vista para uma rua fria e úmida.',
      'Ato 2 — Escócia',
      'Bar escocês',
      null,
      '/art/maps/sgio-scottish-pub.png',
      'medium',
      true,
      50,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000106',
      target_campaign_id,
      'Beco do Desaparecimento',
      'Beco estreito e chuvoso com portas de serviço, escadas metálicas, passagens laterais e muitos pontos de sombra.',
      'Ato 2 — Escócia',
      'Beco do desaparecimento',
      null,
      '/art/maps/sgio-disappearance-alley.png',
      'medium',
      true,
      60,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000107',
      target_campaign_id,
      'Apartamento da Vítima',
      'Apartamento pequeno e recentemente habitado, com sala, cozinha, quarto, banheiro e objetos pessoais.',
      'Ato 2 — Escócia',
      'Apartamento da vítima',
      null,
      '/art/maps/sgio-victim-apartment.png',
      'medium',
      true,
      70,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000108',
      target_campaign_id,
      'Estação Ferroviária Abandonada e Túneis',
      'Plataforma deteriorada conectada a trilhos, salas técnicas, corredores de manutenção e túneis escuros.',
      'Ato 3 — Investigação',
      'Estação e túneis',
      null,
      '/art/maps/sgio-abandoned-station-tunnels.png',
      'huge',
      true,
      80,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000109',
      target_campaign_id,
      'Complexo Industrial Abandonado',
      'Fábrica desativada com grandes galpões, maquinário, tubulações, salas técnicas e passarelas elevadas.',
      'Ato 3 — Investigação',
      'Complexo industrial',
      null,
      '/art/maps/sgio-abandoned-industrial-complex.png',
      'huge',
      true,
      90,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000110',
      target_campaign_id,
      'Complexo Subterrâneo — Ninho',
      'Instalação humana progressivamente reconstruída com metal, cabos, máquinas reaproveitadas e tecnologia biomecânica.',
      'Ato 4 — Ninho',
      'Complexo subterrâneo',
      null,
      '/art/maps/sgio-nest-underground-complex.png',
      'huge',
      true,
      100,
      null
    ),
    (
      '12000000-0000-4000-8000-000000000111',
      target_campaign_id,
      'Câmara Central do Ninho',
      'Câmara monumental com plataformas, passarelas, grandes tubulações e um núcleo biomecânico integrado.',
      'Ato 5 — Final',
      'Câmara central',
      null,
      '/art/maps/sgio-nest-central-chamber.png',
      'huge',
      true,
      110,
      null
    )
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      name = excluded.name,
      description = excluded.description,
      group_name = excluded.group_name,
      layer_name = excluded.layer_name,
      image_file_id = excluded.image_file_id,
      built_in_image_url = excluded.built_in_image_url,
      scale = excluded.scale,
      built_in = excluded.built_in,
      sort_order = excluded.sort_order,
      created_by_user_id = excluded.created_by_user_id,
      updated_at = now();
end;
$$;

commit;
