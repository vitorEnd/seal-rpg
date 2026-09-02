begin;

do $$
declare
  target_admin_id uuid;
  target_campaign_id uuid;
  operation_time timestamptz := statement_timestamp();
begin
  select profile.id
  into strict target_admin_id
  from public.profiles profile
  where lower(profile.email) = lower('vitormonzoleme@gmail.com')
    and profile.role = 'admin'
    and profile.status = 'active';

  insert into public.campaigns (
    id,
    name,
    slug,
    short_description,
    description,
    setting,
    genre,
    status,
    cover_image_url,
    cover_image_storage_key,
    background_image_url,
    background_image_storage_key,
    primary_color,
    secondary_color,
    start_date,
    game_master_user_id,
    story_summary,
    created_at,
    updated_at
  ) values (
    '10000000-0000-4000-8000-000000000002',
    'S.G.I.O. — Os Soldados Fantasmas de Verdrum',
    'sgio-soldados-fantasmas',
    'Agentes extraordinários investigam desaparecimentos ligados a um experimento que aprendeu a sobreviver.',
    'Mutantes, experimentos humanos e tecnologias impossíveis existem às margens do mundo conhecido. A Secretaria Geral de Intervenções Ocultas investiga, contém e, quando julga necessário, utiliza essas anomalias. Quando uma sequência de desaparecimentos na Escócia revela marcas de um protótipo biomecânico considerado morto, seis agentes com origens e capacidades extraordinárias são convocados. Entre segredos institucionais, poderes difíceis de controlar e uma criatura que aprende com cada encontro, eles precisarão se tornar uma equipe antes que o predador compreenda como derrotá-los.',
    'Escócia contemporânea · instalações clandestinas · fenômenos anormais',
    'Ação · suspense · super-heróis · ficção científica',
    'recruiting',
    '/art/sgio-hero.png',
    null,
    '/art/sgio-hero.png',
    null,
    '#e8b04a',
    '#52788f',
    null,
    target_admin_id,
    'A operação ainda não começou. Rotinas controladas dentro da S.G.I.O. convergem quando desaparecimentos na Escócia revelam sinais de um projeto que deveria estar morto.',
    operation_time,
    operation_time
  )
  on conflict (slug) do update
  set game_master_user_id = excluded.game_master_user_id
  returning id into target_campaign_id;

  insert into public.campaign_members (
    id,
    campaign_id,
    user_id,
    role,
    status,
    joined_at,
    created_at,
    updated_at
  ) values (
    '20000000-0000-4000-8000-000000000101',
    target_campaign_id,
    target_admin_id,
    'game_master',
    'approved',
    operation_time,
    operation_time,
    operation_time
  )
  on conflict (campaign_id, user_id) do update
  set role = 'game_master',
      status = 'approved',
      updated_at = operation_time;

  insert into public.campaign_chapters (
    id,
    campaign_id,
    title,
    slug,
    short_description,
    description,
    background_image_url,
    background_image_storage_key,
    sort_order,
    status,
    completed_at,
    created_at,
    updated_at
  ) values (
    '11000000-0000-4000-8000-000000000002',
    target_campaign_id,
    'Protocolo Fantasma',
    'protocolo-fantasma',
    'As rotinas de seis indivíduos extraordinários convergem quando um projeto perdido leva a uma convocação para a Escócia.',
    'Antes da missão na Escócia, o capítulo acompanha a rotina dos futuros integrantes dentro da S.G.I.O.: treinamentos, exames, pesquisas e pequenos sinais de que algo não está sob controle. Enquanto Nathan Voss reconhece nos desaparecimentos marcas de um projeto enterrado, seis indivíduos são convocados e colocados pela primeira vez sob a mesma ordem.',
    '/art/sgio-hero.png',
    null,
    1,
    'published',
    null,
    operation_time,
    operation_time
  )
  on conflict (campaign_id, slug) do nothing;

  insert into public.character_status_options (
    id,
    campaign_id,
    name,
    slug,
    color,
    sort_order,
    active,
    created_at,
    updated_at
  ) values
    ('32000000-0000-4000-8000-000000000101', target_campaign_id, 'Em avaliação', 'em-avaliacao', '#e8b04a', 1, true, operation_time, operation_time),
    ('32000000-0000-4000-8000-000000000102', target_campaign_id, 'Operacional', 'operacional', '#4e9f85', 2, true, operation_time, operation_time),
    ('32000000-0000-4000-8000-000000000103', target_campaign_id, 'Sob supervisão', 'sob-supervisao', '#6f8fa1', 3, true, operation_time, operation_time),
    ('32000000-0000-4000-8000-000000000104', target_campaign_id, 'Ferido', 'ferido', '#a94f55', 4, true, operation_time, operation_time),
    ('32000000-0000-4000-8000-000000000105', target_campaign_id, 'Instável', 'instavel', '#c56a45', 5, true, operation_time, operation_time),
    ('32000000-0000-4000-8000-000000000106', target_campaign_id, 'Contido', 'contido', '#725889', 6, true, operation_time, operation_time)
  on conflict (campaign_id, slug) do nothing;

  insert into public.character_class_options (
    id,
    campaign_id,
    name,
    slug,
    description,
    logo_image_url,
    logo_image_storage_key,
    bonus_physical,
    bonus_agility,
    bonus_marksmanship,
    bonus_perception,
    bonus_technique,
    bonus_control,
    sort_order,
    active,
    created_at,
    updated_at
  ) values
    ('33000000-0000-4000-8000-000000000101', target_campaign_id, 'Operativo de campo', 'operativo-de-campo', 'Especialista em confronto direto, armas e decisões rápidas sob ameaça.', null, null, 0, 0, 1, 0, 0, 0, 1, true, operation_time, operation_time),
    ('33000000-0000-4000-8000-000000000102', target_campaign_id, 'Especialista tecnológico', 'especialista-tecnologico', 'Cientista, inventor ou hacker capaz de dominar sistemas e equipamentos avançados.', null, null, 0, 0, 0, 0, 1, 0, 2, true, operation_time, operation_time),
    ('33000000-0000-4000-8000-000000000103', target_campaign_id, 'Manifestação energética', 'manifestacao-energetica', 'Canaliza uma força anormal que exige precisão, foco e domínio constante.', null, null, 0, 0, 0, 0, 0, 1, 3, true, operation_time, operation_time),
    ('33000000-0000-4000-8000-000000000104', target_campaign_id, 'Organismo adaptativo', 'organismo-adaptativo', 'Altera propriedades, responde ao ambiente e encontra novas formas de sobreviver.', null, null, 0, 1, 0, 0, 0, 0, 4, true, operation_time, operation_time),
    ('33000000-0000-4000-8000-000000000105', target_campaign_id, 'Unidade biomecânica', 'unidade-biomecanica', 'Corpo reforçado ou sintético criado para superar limites humanos.', null, null, 1, 0, 0, 0, 0, 0, 5, true, operation_time, operation_time),
    ('33000000-0000-4000-8000-000000000106', target_campaign_id, 'Investigador anômalo', 'investigador-anomalo', 'Rastreia padrões impossíveis, lê cenas e identifica fenômenos ocultos.', null, null, 0, 0, 0, 1, 0, 0, 6, true, operation_time, operation_time)
  on conflict (campaign_id, slug) do nothing;
end;
$$;

commit;
