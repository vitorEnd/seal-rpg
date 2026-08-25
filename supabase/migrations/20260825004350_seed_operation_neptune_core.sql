insert into public.campaigns (
  id,name,slug,short_description,description,setting,genre,status,
  cover_image_url,cover_image_storage_key,background_image_url,background_image_storage_key,
  primary_color,secondary_color,start_date,game_master_user_id,story_summary,created_at,updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  'Operação Neptune',
  'operacao-neptune',
  'Uma equipe SEAL é enviada ao Afeganistão para descobrir o próximo movimento da Al-Qaeda.',
  'Em 2018, sinais fragmentados e movimentações incomuns apontam que uma célula da Al-Qaeda prepara uma operação de grande escala no Afeganistão. Uma equipe de fuzileiros de operações especiais SEAL é enviada sob uma missão não reconhecida oficialmente: entrar no país, localizar a rede responsável e descobrir o que está sendo planejado antes que seja tarde. Entre vales isolados, rotas clandestinas, aliados incertos e ordens que mudam no meio da operação, cada decisão pode comprometer a equipe — ou impedir uma ameaça que ninguém mais consegue enxergar.',
  'Afeganistão · 2018 · guerra assimétrica e operações clandestinas',
  'Military / Tactical RPG',
  'draft',
  '/art/neptune-hero.png',null,'/art/neptune-hero.png',null,
  '#e8792f','#66737d',null,null,
  'A operação ainda não começou. O primeiro dossiê acompanha o encontro da equipe que será enviada ao Afeganistão.',
  '2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'
)
on conflict (id) do nothing;

insert into public.campaign_chapters (
  id,campaign_id,title,slug,short_description,description,
  background_image_url,background_image_storage_key,sort_order,status,completed_at,created_at,updated_at
) values (
  '11000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'O Prólogo','o-prologo',
  'Antes da primeira missão, quatro operadores precisam descobrir se conseguem confiar uns nos outros.',
  'O início da história mostra como a equipe foi reunida, quais interesses colocaram cada integrante na operação e o primeiro contato entre pessoas treinadas para agir sozinhas, mas que agora dependerão umas das outras.',
  '/art/neptune-prologue.png',null,1,'published',null,
  '2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'
)
on conflict (id) do nothing;

insert into public.character_status_options
(id,campaign_id,name,slug,color,sort_order,active,created_at,updated_at)
values
('32000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Em preparação','em-preparacao','#d6a45d',1,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('32000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Ativo','ativo','#70a37f',2,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('32000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Ferido','ferido','#b8614b',3,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z')
on conflict (id) do nothing;

insert into public.character_class_options
(id,campaign_id,name,slug,description,logo_image_url,logo_image_storage_key,bonus_physical,bonus_agility,bonus_marksmanship,bonus_perception,bonus_technique,bonus_control,sort_order,active,created_at,updated_at)
values
('33000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Assalto','assalto','Operador de linha de frente e entrada tática.',null,null,0,0,0,0,0,0,1,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('33000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Reconhecimento','reconhecimento','Especialista em observação, infiltração e inteligência de campo.',null,null,0,0,0,0,0,0,2,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('33000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Médico de combate','medico-de-combate','Responsável por trauma, estabilização e evacuação sob fogo.',null,null,0,0,0,0,0,0,3,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('33000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Demolições','demolicoes','Especialista em explosivos, brechas e neutralização de ameaças.',null,null,0,0,0,0,0,0,4,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('33000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Comunicações','comunicacoes','Coordena sinais, apoio remoto e contato com o comando.',null,null,0,0,0,0,0,0,5,true,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z')
on conflict (id) do nothing;

insert into public.virtual_table_maps
(id,campaign_id,name,description,group_name,layer_name,image_file_id,built_in_image_url,scale,built_in,sort_order,created_by_user_id,created_at,updated_at)
values
('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Navio cargueiro — convés principal','Convés de carga da primeira missão, sob cobertura da noite.','Navio cargueiro','Convés principal',null,'/art/maps/neptune-cargo-ship-main-deck.png','huge',true,10,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Navio cargueiro — convés superior','Ponte, passarelas e estruturas superiores do cargueiro.','Navio cargueiro','Convés superior',null,'/art/maps/neptune-cargo-ship-upper-deck.png','huge',true,11,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Navio cargueiro — nível inferior','Porões, corredores técnicos e compartimentos abaixo do convés.','Navio cargueiro','Nível inferior',null,'/art/maps/neptune-cargo-ship-lower-deck.png','huge',true,12,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Base dos SEALs','Complexo operacional com sede, escritórios e alojamentos.','Base dos SEALs','Complexo principal',null,'/art/maps/neptune-seal-base.png','large',true,20,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Heliporto','Área de embarque e preparação para a inserção aérea.','Heliporto','Plataforma',null,'/art/maps/neptune-helipad.png','medium',true,30,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Zona de inserção','Área desértica e rochosa onde a equipe desembarca antes da infiltração.','Zona de inserção','Área principal',null,'/art/maps/neptune-insertion-zone.png','medium',true,40,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Complexo industrial costeiro — área externa','Perímetro murado, pátio logístico, contêineres e acessos ao complexo.','Complexo industrial costeiro','Área externa',null,'/art/maps/neptune-industrial-complex-exterior.png','large',true,50,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Complexo industrial costeiro — galpão principal','Galpão de carga com caixas, veículos, depósitos e espaço amplo para confronto.','Complexo industrial costeiro','Galpão principal',null,'/art/maps/neptune-industrial-complex-warehouse.png','large',true,51,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','Complexo industrial costeiro — administração e controle','Escritórios, arquivo, comunicações e sala de controle da instalação.','Complexo industrial costeiro','Administração e controle',null,'/art/maps/neptune-industrial-complex-control.png','large',true,52,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','Safehouse urbano — rua e exterior','Casa segura discreta em uma rua estreita, cercada por muros de concreto.','Safehouse urbano','Rua e exterior',null,'/art/maps/neptune-safehouse-exterior.png','medium',true,60,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','Safehouse urbano — térreo','Interior compacto com sala, cozinha, banheiro, depósito e material operacional.','Safehouse urbano','Térreo',null,'/art/maps/neptune-safehouse-ground-floor.png','medium',true,61,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z'),
('12000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','Safehouse urbano — porão oculto','Camada subterrânea improvisada com documentos, comunicações e suprimentos escondidos.','Safehouse urbano','Porão oculto',null,'/art/maps/neptune-safehouse-basement.png','medium',true,62,null,'2026-08-23T12:00:00.000Z','2026-08-23T12:00:00.000Z')
on conflict (id) do nothing;
