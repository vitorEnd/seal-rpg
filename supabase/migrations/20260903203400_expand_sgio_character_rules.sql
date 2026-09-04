begin;

alter table public.character_class_options
  add column bonus_resilience smallint not null default 0
    constraint character_class_options_bonus_resilience_check
    check (bonus_resilience between 0 and 5),
  add column bonus_intellect smallint not null default 0
    constraint character_class_options_bonus_intellect_check
    check (bonus_intellect between 0 and 5),
  add column bonus_presence smallint not null default 0
    constraint character_class_options_bonus_presence_check
    check (bonus_presence between 0 and 5),
  add column bonus_energy smallint not null default 0
    constraint character_class_options_bonus_energy_check
    check (bonus_energy between 0 and 5),
  add column bonus_adaptation smallint not null default 0
    constraint character_class_options_bonus_adaptation_check
    check (bonus_adaptation between 0 and 5);

alter table public.characters
  add column attribute_resilience smallint not null default 0
    constraint characters_attribute_resilience_check
    check (attribute_resilience between 0 and 5),
  add column attribute_intellect smallint not null default 0
    constraint characters_attribute_intellect_check
    check (attribute_intellect between 0 and 5),
  add column attribute_presence smallint not null default 0
    constraint characters_attribute_presence_check
    check (attribute_presence between 0 and 5),
  add column attribute_energy smallint not null default 0
    constraint characters_attribute_energy_check
    check (attribute_energy between 0 and 5),
  add column attribute_adaptation smallint not null default 0
    constraint characters_attribute_adaptation_check
    check (attribute_adaptation between 0 and 5);

alter table public.characters
  drop constraint characters_attribute_budget_check,
  add constraint characters_attribute_budget_check check (
    case
      when campaign_id = '10000000-0000-4000-8000-000000000002'::uuid then
        attribute_physical + attribute_agility + attribute_marksmanship +
        attribute_perception + attribute_technique + attribute_control +
        attribute_resilience + attribute_intellect + attribute_presence +
        attribute_energy + attribute_adaptation = 6
      else
        attribute_physical + attribute_agility + attribute_marksmanship +
        attribute_perception + attribute_technique + attribute_control = 8
        and attribute_resilience = 0
        and attribute_intellect = 0
        and attribute_presence = 0
        and attribute_energy = 0
        and attribute_adaptation = 0
    end
  );

update public.campaigns
set primary_color = '#ff465f',
    secondary_color = '#51e7ef',
    updated_at = statement_timestamp()
where slug = 'sgio-soldados-fantasmas';

update public.character_class_options
set name = case id
      when '33000000-0000-4000-8000-000000000101'::uuid then 'Humano'
      when '33000000-0000-4000-8000-000000000102'::uuid then 'Mutante'
      when '33000000-0000-4000-8000-000000000103'::uuid then 'Clone'
      when '33000000-0000-4000-8000-000000000104'::uuid then 'Máquina'
      else name
    end,
    slug = case id
      when '33000000-0000-4000-8000-000000000101'::uuid then 'humano'
      when '33000000-0000-4000-8000-000000000102'::uuid then 'mutante'
      when '33000000-0000-4000-8000-000000000103'::uuid then 'clone'
      when '33000000-0000-4000-8000-000000000104'::uuid then 'maquina'
      else slug
    end,
    description = case id
      when '33000000-0000-4000-8000-000000000101'::uuid then
        'Pessoa humana sem origem artificial obrigatória; treinamento, talento e escolhas definem suas capacidades.'
      when '33000000-0000-4000-8000-000000000102'::uuid then
        'Organismo transformado por mutação natural, induzida ou desconhecida, capaz de manifestar traços extraordinários.'
      when '33000000-0000-4000-8000-000000000103'::uuid then
        'Cópia biológica produzida ou modificada artificialmente, com memórias, finalidade e identidade próprias.'
      when '33000000-0000-4000-8000-000000000104'::uuid then
        'Consciência sintética, corpo mecânico ou construção biomecânica criada para operar além dos limites orgânicos.'
      else description
    end,
    bonus_physical = 0,
    bonus_agility = 0,
    bonus_marksmanship = 0,
    bonus_perception = 0,
    bonus_technique = 0,
    bonus_control = 0,
    bonus_resilience = 0,
    bonus_intellect = 0,
    bonus_presence = 0,
    bonus_energy = 0,
    bonus_adaptation = 0,
    sort_order = case id
      when '33000000-0000-4000-8000-000000000101'::uuid then 1
      when '33000000-0000-4000-8000-000000000102'::uuid then 2
      when '33000000-0000-4000-8000-000000000103'::uuid then 3
      when '33000000-0000-4000-8000-000000000104'::uuid then 4
      else sort_order
    end,
    active = id in (
      '33000000-0000-4000-8000-000000000101'::uuid,
      '33000000-0000-4000-8000-000000000102'::uuid,
      '33000000-0000-4000-8000-000000000103'::uuid,
      '33000000-0000-4000-8000-000000000104'::uuid
    ),
    updated_at = statement_timestamp()
where campaign_id = '10000000-0000-4000-8000-000000000002'::uuid;

delete from public.character_class_options
where campaign_id = '10000000-0000-4000-8000-000000000002'::uuid
  and id in (
    '33000000-0000-4000-8000-000000000105'::uuid,
    '33000000-0000-4000-8000-000000000106'::uuid
  );

commit;
