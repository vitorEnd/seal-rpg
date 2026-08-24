# Migração do SEAL RPG para Supabase

## Limite de segurança

- O destino deve ser uma organização nova chamada `SEAL RPG` e um projeto novo chamado `seal-rpg`.
- Nenhuma migration, consulta, chave ou variável deste projeto pode apontar para o projeto Supabase antigo.
- O deploy no Render permanece fora de escopo até Auth, banco, Storage, Realtime e RLS passarem pelos testes de integração.

## Fonte de dados local

A fonte vigente é `.local/rpg-vitin.json` (formato V6), não `data/seed.json`.

Inventário auditado em 24/08/2026:

- 1 campanha;
- 3 capítulos;
- 3 usuários de desenvolvimento;
- 2 associações de campanha;
- 12 mapas;
- 2 uploads reais de capítulos (4.241.019 bytes no total);
- nenhuma sessão realizada, personagem, token ou rolagem persistida.

Hash SHA-256 do snapshot auditado:

```text
631DFB18154A70CB41D4E4056B8BD708D1B4174F95D14163EDE5BCE3BC24E030
```

Antes da importação remota, o hash será calculado novamente. Se ele tiver mudado, um novo inventário será produzido para que dados criados durante a migração não sejam perdidos.

## Auth

Os hashes scrypt e as sessões locais não serão importados. Cada pessoa receberá uma conta nova no Supabase Auth. Um mapa temporário `old_user_id -> auth.users.id` será usado para remapear mestre, membros, personagens e rolagens durante a importação.

O trigger de perfil sempre cria novos usuários como `player/active`; metadados do cadastro nunca controlam `role` ou `status`. O primeiro administrador será promovido de forma explícita durante o bootstrap.

## Banco e autorização

As migrations em `supabase/migrations` criam:

- perfis, campanhas, membros, capítulos, classes/status e personagens;
- equipes, missões, sessões, eventos e arquivos;
- mapas, mesas, tokens, transições de capítulo e rolagens;
- chaves compostas que impedem referências entre campanhas;
- orçamento obrigatório de 8 pontos de atributos, máximo de 5 por atributo;
- RLS para `admin`, `game_master`, `player`, pendentes, removidos e desabilitados;
- projeções públicas limitadas para os cards da home;
- somente o resumo visual dos cards é público; campanha, capítulos, membros e mesa continuam privados;
- timeline que mantém o lugar de capítulos futuros, mas remove ID, slug, título real, descrição e imagem;
- RPCs transacionais para abrir/fechar mesa, encerrar uma sessão administrativa,
  trocar mapa, preservar o mapa legado, mover token, rolar dados e avançar capítulo.

## Storage

O bucket privado `campaign-media` aceita JPEG, PNG, WebP e AVIF até 6 MiB. As chaves seguem:

```text
<campaign_uuid>/<object_uuid>.<extensão>
```

Capas públicas, capítulos desbloqueados, fichas e arquivos respeitam políticas próprias. Capítulos bloqueados não liberam suas imagens. Upload, alteração e exclusão são validados por usuário e campanha.

Arquivos de mapas e imagens de tokens serão gravados como `game_master` por padrão.
Mesmo que um registro legado esteja como `members`, as policies só o liberam ao
jogador quando o mapa estiver ativo ou o token estiver visível no mapa ativo.

## Realtime da mesa

Cada mesa aberta usa um canal privado:

```text
vtt:<table_uuid>
```

- Presence informa jogadores conectados.
- A prévia efêmera do arraste passa por uma RPC autorizada e é então enviada por
  Broadcast; clientes não têm permissão para forjar broadcasts diretamente.
- Tokens ocultos nunca geram prévia de movimento para jogadores; o mestre ainda
  pode reposicioná-los, e o snapshot recarregado continua filtrado pelas policies.
- A posição final é persistida uma única vez ao soltar o token.
- Alterações permanentes incrementam `virtual_tables.revision`.
- O banco transmite somente `{ tableId, revision }`; o cliente recarrega um snapshot autorizado e não recebe dados de tokens ocultos no evento.
- Jogadores só consultam o mapa ativo e seus tokens visíveis; a biblioteca completa
  continua disponível apenas para admin/mestre.
- Não haverá WebSocket próprio, Redis ou banco adicional no Render.

## Variáveis do novo projeto

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
RPG_DATA_PROVIDER=supabase
NEXT_PUBLIC_SITE_URL
```

`SUPABASE_SECRET_KEY` é exclusivamente server-side. Ela será isolada em um módulo `server-only` para bootstrap/migração e para preservar login por nome de usuário sem publicar o e-mail correspondente. Nunca terá o prefixo `NEXT_PUBLIC_`.

## Ordem restante

1. Criar a organização isolada e o projeto novo.
2. Aplicar migrations e executar advisors de segurança/desempenho.
3. Gerar os tipos TypeScript do schema remoto.
4. Implementar clientes SSR e adapters Supabase mantendo os contratos atuais.
5. Recriar contas e importar o snapshot normalizado e os dois uploads.
6. Substituir o polling de ~900 ms por Broadcast/Presence, com fallback lento de recuperação.
7. Testar matriz de RLS e fluxos completos com usuários distintos.
8. Somente depois configurar GitHub e um único Web Service Free no Render.
