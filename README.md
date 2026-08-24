# RPG Vitin

Aplicação web privada para organizar campanhas de RPG. O conteúdo inicial contém somente a **Operação Neptune**, ainda em preparação e sem sessões ou fichas fictícias.

## Estado atual

- interface cinematográfica responsiva para a Operação Neptune;
- menu da campanha com **Campanha**, **Visão Geral**, **Ficha** e **Sessões**;
- capítulo inicial **O Prólogo** com acesso à mesa virtual 2D;
- mesa compartilhada com biblioteca de mapas, camadas, pan/zoom amplo, tokens por andar e controle por proprietário;
- personalização de aliados, inimigos e objetos, cones de visão e fichas de campo com equipamentos, ferimentos, mochila e slots;
- dados d4, d6, d8, d10, d12, d20 e d100, animação, comandos compostos e histórico da sessão;
- painel administrativo com CRUD de campanhas, capítulos, status, classes e sessões;
- criação e edição de fichas com imagens, cores e opções controladas pelo administrador;
- upload local validado de JPEG, PNG, WebP e AVIF, com limite de 6 MB;
- autenticação, autorização, persistência JSON e testes automatizados locais;
- arquitetura por contratos para substituir os adapters locais por banco, autenticação e storage de produção depois.

Recursos avançados como mapa 3D, iluminação dinâmica, fog of war e iniciativa automática não fazem parte deste MVP. Nenhum serviço externo, Supabase, Vercel ou deploy foi configurado.

## Aviso: desenvolvimento local

Esta versão não deve ser exposta à internet. A autenticação e o armazenamento em arquivos servem somente para desenvolvimento:

- não use senhas reais;
- não há recuperação de senha, confirmação de e-mail, MFA ou rate limiting;
- o provider local bloqueia execução em ambiente Vercel;
- os uploads ficam no disco local e não são adequados para uma aplicação distribuída.

## Executar

Requisitos: Node.js 20.9 ou superior e npm.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Na primeira execução, `.local/rpg-vitin.json` é criado a partir de `data/seed.json`.

## Contas DEV ONLY

| Papel | Usuário | Senha |
| --- | --- | --- |
| Administrador | `admin` | `neptune-dev` |
| Mestre | `gm` | `master-dev` |
| Jogador | `player` | `player-dev` |

O login também aceita os e-mails `admin@rpg.test`, `gm@rpg.test` e `player@rpg.test`.

## Rotas principais

- `/` — apresentação da campanha;
- `/login` e `/register` — autenticação local;
- `/campaigns` — campanhas permitidas para o usuário;
- `/campaigns/[slug]` — capítulos;
- `/campaigns/[slug]/overview` — visão geral;
- `/campaigns/[slug]/sheet` — fichas;
- `/campaigns/[slug]/sessions` — sessões realizadas e futuras;
- `/campaigns/[slug]/table` — sala de espera e mesa virtual da sessão aberta;
- `/admin` — central protegida para o administrador;
- `/media/[...key]` — leitura por chave dos uploads locais.

## Administração

Entre como `admin` e abra `/admin`. A central permite:

1. criar, editar ou excluir campanhas e trocar capa/fundo;
2. criar, ordenar, publicar, editar e excluir capítulos;
3. cadastrar os status e as classes disponíveis nas fichas;
4. acompanhar e editar as fichas que aparecem na campanha;
5. agendar, concluir, cancelar, editar ou excluir sessões.

O administrador ou mestre da campanha pode abrir a mesa pela própria campanha. Se não houver uma sessão agendada, essa ação cria a primeira sessão real; o seed continua sem sessões fictícias. Enquanto a mesa estiver aberta, membros aprovados enxergam o mesmo snapshot por sincronização local periódica. Movimentos, trocas de mapa/camada, inventários e personalizações são persistidos; as rolagens são calculadas no servidor e anunciadas para todos.

O seed é honesto: só existe Neptune, o capítulo **O Prólogo**, opções iniciais de ficha e os vínculos de acesso. Não existe sessão realizada, personagem, missão ou histórico de exemplo.

## Dados e imagens locais

```text
data/seed.json            snapshot inicial versionado
.local/rpg-vitin.json     dados mutáveis, ignorados pelo Git
.local/uploads/           imagens enviadas, ignoradas pelo Git
public/art/               artes iniciais versionadas da campanha
```

Para apagar todas as alterações e uploads locais e voltar exatamente ao seed:

```bash
npm run data:reset
```

## Qualidade

```bash
npm run check
npm run build
```

`npm run check` executa ESLint, TypeScript estrito e Vitest. Os testes usam diretórios temporários e não alteram `.local/rpg-vitin.json`.

## Arquitetura e futura produção

```text
src/app/                    páginas, rotas e Server Actions
src/components/             interface React
src/domain/                 entidades, contratos e permissões
src/application/            portas e modelos de leitura
src/infrastructure/local/   adapters JSON, auth e arquivos DEV ONLY
src/lib/                    composition root e sessão
```

Páginas e formulários dependem de repositories e providers, não do JSON diretamente. Na etapa de deploy, os adapters locais deverão ser substituídos por persistência transacional, autenticação real e object storage; as regras também deverão ser reforçadas no banco. Essa troca ainda não foi executada.
