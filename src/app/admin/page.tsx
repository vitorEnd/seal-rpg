import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CampaignAdminForm } from "@/components/admin/campaign-admin-forms";
import {
  CampaignMembershipAdminForm,
  UserAccessAdminForm,
} from "@/components/admin/access-admin-forms";
import { ChapterAdminForm } from "@/components/admin/chapter-admin-forms";
import { CharacterOptionAdminForm } from "@/components/admin/option-admin-forms";
import { SessionAdminForm } from "@/components/admin/session-admin-forms";
import { CharacterSheetForm } from "@/components/campaigns/character-sheet-form";
import { SiteHeader } from "@/components/site/site-header";
import { getCharacterOptionTerminology } from "@/domain/campaign-rules";
import { getCurrentSession } from "@/lib/auth/current-user";
import { repositories } from "@/lib/container";

export const metadata: Metadata = {
  title: "Central administrativa",
  description: "Gerencie campanhas, capítulos, fichas e sessões do RPG Vitin.",
};
export const dynamic = "force-dynamic";

const adminViews = [
  { id: "overview", number: "00", label: "Visão do arquivo" },
  { id: "campaigns", number: "01", label: "Campanhas" },
  { id: "chapters", number: "02", label: "Capítulos" },
  { id: "options", number: "03", label: "Opções da ficha" },
  { id: "sheets", number: "04", label: "Fichas" },
  { id: "sessions", number: "05", label: "Sessões" },
  { id: "access", number: "06", label: "Acessos" },
] as const;

type AdminView = (typeof adminViews)[number]["id"];

function isAdminView(value: string | undefined): value is AdminView {
  return adminViews.some((item) => item.id === value);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/admin");
  if (session.user.role !== "admin") redirect("/access-denied");

  const { view: requestedView } = await searchParams;
  const view: AdminView = isAdminView(requestedView) ? requestedView : "overview";
  const [
    campaigns,
    users,
    chapters,
    statuses,
    classes,
    characters,
    sessions,
    memberships,
  ] =
    await Promise.all([
      repositories.campaigns.list(),
      repositories.users.list(),
      repositories.campaignChapters.list(),
      repositories.characterStatusOptions.list(),
      repositories.characterClassOptions.list(),
      repositories.characters.list(),
      repositories.campaignSessions.list(),
      repositories.campaignMembers.list(),
    ]);
  const managers = users.filter(
    (user) => user.status === "active" && user.role !== "player",
  );
  const primaryCampaign = campaigns[0] ?? null;
  const primaryChapter = primaryCampaign
    ? chapters
        .filter((chapter) => chapter.campaignId === primaryCampaign.id)
        .sort((left, right) => left.order - right.order)[0] ?? null
    : null;
  const previewHref = primaryCampaign
    ? `/campaigns/${primaryCampaign.slug}`
    : "/campaigns";

  return (
    <main className="admin-page">
      <SiteHeader user={session.user} active="admin" />
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-heading">
            <span>ADM</span>
            <div>
              <strong>Central de comando</strong>
              <small>Controle privado</small>
            </div>
          </div>
          <nav aria-label="Seções administrativas">
            {adminViews.map((item) => (
              <Link
                key={item.id}
                href={item.id === "overview" ? "/admin" : `/admin?view=${item.id}`}
                aria-current={view === item.id ? "page" : undefined}
              >
                <span>{item.number}</span>
                <strong>{item.label}</strong>
              </Link>
            ))}
          </nav>
          <div className="admin-local-note">
            <span aria-hidden="true" />
            <p><strong>Supabase conectado</strong>Contas e acessos são aplicados no servidor.</p>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-page-heading">
            <div>
              <p className="admin-kicker">RPG Vitin · controle de conteúdo</p>
              <h1>{adminViews.find((item) => item.id === view)?.label}</h1>
            </div>
            <Link href={previewHref} className="admin-preview-link">
              Ver aplicação <span>↗</span>
            </Link>
          </header>

          {view === "overview" ? (
            <section className="admin-overview" aria-label="Resumo administrativo">
              <div className="admin-summary-grid">
                {[
                  ["Campanhas", campaigns.length],
                  ["Capítulos", chapters.length],
                  ["Fichas", characters.length],
                  ["Sessões", sessions.length],
                ].map(([label, count]) => (
                  <article key={label}>
                    <span>{String(count).padStart(2, "0")}</span>
                    <p>{label}</p>
                  </article>
                ))}
              </div>
              <div className="admin-welcome-panel">
                <div>
                  <p className="admin-kicker">Arquivo pronto para começar</p>
                  <h2>
                    {primaryCampaign
                      ? `${primaryCampaign.name} está em preparação.`
                      : "O arquivo está pronto para a primeira campanha."}
                  </h2>
                  <p>
                    O conteúdo demonstrativo foi removido. Agora você controla a campanha real: altere as artes e informações, publique capítulos, configure as opções das fichas e registre sessões quando elas realmente acontecerem.
                  </p>
                </div>
                <div className="admin-quick-links">
                  <Link href="/admin?view=campaigns">Editar {primaryCampaign?.name ?? "campanhas"} <span>→</span></Link>
                  <Link href="/admin?view=chapters">Gerenciar {primaryChapter?.title ?? "capítulos"} <span>→</span></Link>
                  <Link href="/admin?view=sessions">Agendar primeira sessão <span>→</span></Link>
                </div>
              </div>
            </section>
          ) : null}

          {view === "campaigns" ? (
            <section className="admin-stack">
              <details className="admin-disclosure" open={!campaigns.length}>
                <summary>Criar nova campanha</summary>
                <CampaignAdminForm managers={managers} />
              </details>
              {campaigns.map((campaign) => (
                <details key={campaign.id} className="admin-disclosure" open={campaigns.length === 1}>
                  <summary>Editar · {campaign.name}</summary>
                  <CampaignAdminForm campaign={campaign} managers={managers} />
                </details>
              ))}
            </section>
          ) : null}

          {view === "chapters" ? (
            <section className="admin-stack">
              {campaigns.map((campaign) => {
                const campaignChapters = chapters.filter((item) => item.campaignId === campaign.id);
                return (
                  <div key={campaign.id} className="admin-resource-group">
                    <div className="admin-resource-heading">
                      <div><p className="admin-kicker">Campanha</p><h2>{campaign.name}</h2></div>
                      <span>{campaignChapters.length} capítulos</span>
                    </div>
                    <details className="admin-disclosure">
                      <summary>Adicionar capítulo</summary>
                      <ChapterAdminForm campaign={campaign} />
                    </details>
                    {campaignChapters.map((chapter) => (
                      <details key={chapter.id} className="admin-disclosure" open={campaignChapters.length === 1}>
                        <summary>Capítulo {chapter.order} · {chapter.title}</summary>
                        <ChapterAdminForm campaign={campaign} chapter={chapter} />
                      </details>
                    ))}
                  </div>
                );
              })}
            </section>
          ) : null}

          {view === "options" ? (
            <section className="admin-stack">
              {campaigns.map((campaign) => {
                const campaignStatuses = statuses.filter((item) => item.campaignId === campaign.id);
                const campaignClasses = classes.filter((item) => item.campaignId === campaign.id);
                const terminology = getCharacterOptionTerminology(campaign.slug);
                return (
                  <div key={campaign.id} className="admin-resource-group">
                    <div className="admin-resource-heading">
                      <div><p className="admin-kicker">Configuração de ficha</p><h2>{campaign.name}</h2></div>
                    </div>
                    <div className="admin-options-columns">
                      <div>
                        <h3>Status disponíveis</h3>
                        {campaignStatuses.map((option) => (
                          <CharacterOptionAdminForm key={option.id} campaign={campaign} kind="status" option={option} />
                        ))}
                        <CharacterOptionAdminForm campaign={campaign} kind="status" />
                      </div>
                      <div>
                        <h3>{terminology.plural} disponíveis</h3>
                        {campaignClasses.map((option) => (
                          <CharacterOptionAdminForm key={option.id} campaign={campaign} kind="class" option={option} />
                        ))}
                        <CharacterOptionAdminForm campaign={campaign} kind="class" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}

          {view === "sheets" ? (
            <section className="admin-stack">
              {campaigns.map((campaign) => {
                const campaignSheets = characters.filter((item) => item.campaignId === campaign.id);
                const campaignStatuses = statuses.filter((item) => item.campaignId === campaign.id);
                const campaignClasses = classes.filter((item) => item.campaignId === campaign.id);
                return (
                  <div key={campaign.id} className="admin-resource-group">
                    <div className="admin-resource-heading">
                      <div><p className="admin-kicker">Fichas da campanha</p><h2>{campaign.name}</h2></div>
                      <Link href={`/campaigns/${campaign.slug}/sheet#campaign-content`}>Abrir tela dos jogadores ↗</Link>
                    </div>
                    {!campaignSheets.length ? <p className="admin-empty-copy">Nenhuma ficha foi criada ainda.</p> : null}
                    {campaignSheets.map((sheet) => (
                      <details key={sheet.id} className="admin-disclosure">
                        <summary>Editar ficha · {sheet.name}</summary>
                        <CharacterSheetForm campaign={campaign} statusOptions={campaignStatuses} classOptions={campaignClasses} sheet={sheet} />
                      </details>
                    ))}
                  </div>
                );
              })}
            </section>
          ) : null}

          {view === "sessions" ? (
            <section className="admin-stack">
              {campaigns.map((campaign) => {
                const campaignSessions = sessions
                  .filter((item) => item.campaignId === campaign.id)
                  .sort((left, right) => right.sessionNumber - left.sessionNumber);
                const nextNumber = Math.max(0, ...campaignSessions.map((item) => item.sessionNumber)) + 1;
                return (
                  <div key={campaign.id} className="admin-resource-group">
                    <div className="admin-resource-heading">
                      <div><p className="admin-kicker">Diário da mesa</p><h2>{campaign.name}</h2></div>
                      <span>{campaignSessions.length} registros</span>
                    </div>
                    {!campaignSessions.length ? (
                      <div className="admin-empty-state">
                        <span>00</span><div><h3>Nenhuma sessão registrada.</h3><p>Use o formulário abaixo para agendar uma data futura ou registrar uma sessão depois que ela acontecer.</p></div>
                      </div>
                    ) : null}
                    <details className="admin-disclosure" open={!campaignSessions.length}>
                      <summary>Criar sessão</summary>
                      <SessionAdminForm campaign={campaign} nextNumber={nextNumber} />
                    </details>
                    {campaignSessions.map((campaignSession) => (
                      <details key={campaignSession.id} className="admin-disclosure">
                        <summary>Sessão {campaignSession.sessionNumber} · {campaignSession.title}</summary>
                        <SessionAdminForm campaign={campaign} session={campaignSession} nextNumber={nextNumber} />
                      </details>
                    ))}
                  </div>
                );
              })}
            </section>
          ) : null}

          {view === "access" ? (
            <section className="admin-stack">
              <div className="admin-resource-group">
                <div className="admin-resource-heading">
                  <div>
                    <p className="admin-kicker">Contas do grupo</p>
                    <h2>Usuários</h2>
                  </div>
                  <span>{users.length} contas</span>
                </div>
                <p className="admin-empty-copy">
                  Use esta área para promover um mestre ou desativar uma conta. O banco impede que o último administrador ativo seja removido.
                </p>
                {users.map((user) => (
                  <UserAccessAdminForm key={user.id} user={user} />
                ))}
              </div>

              {campaigns.map((campaign) => {
                const campaignMemberships = memberships
                  .filter((membership) => membership.campaignId === campaign.id)
                  .sort(
                    (left, right) =>
                      Number(left.status !== "pending") -
                        Number(right.status !== "pending") ||
                      left.joinedAt.localeCompare(right.joinedAt),
                  );
                return (
                  <div key={campaign.id} className="admin-resource-group">
                    <div className="admin-resource-heading">
                      <div>
                        <p className="admin-kicker">Aprovação de jogadores</p>
                        <h2>{campaign.name}</h2>
                      </div>
                      <span>{campaignMemberships.length} solicitações</span>
                    </div>
                    {!campaignMemberships.length ? (
                      <p className="admin-empty-copy">
                        Nenhum amigo solicitou acesso ainda.
                      </p>
                    ) : null}
                    {campaignMemberships.map((membership) => (
                      <CampaignMembershipAdminForm
                        key={membership.id}
                        membership={membership}
                        campaign={campaign}
                        user={
                          users.find((user) => user.id === membership.userId) ??
                          null
                        }
                      />
                    ))}
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
