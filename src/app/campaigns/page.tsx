import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignAccessCard } from "@/components/campaigns/campaign-access-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentSession } from "@/lib/auth/current-user";
import { getCampaignDirectory, getCampaignsForUser } from "@/lib/campaign-data";
import { repositories } from "@/lib/container";

export const metadata: Metadata = {
  title: "Campanhas",
  description: "Campanhas disponíveis para o usuário atual do RPG Vitin.",
};
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [session, campaigns] = await Promise.all([
    getCurrentSession(),
    getCampaignDirectory(),
  ]);
  if (!session) redirect("/login?next=%2Fcampaigns");
  const [accessibleCampaigns, memberships] =
    session.user.role === "admin"
      ? [campaigns, []]
      : await Promise.all([
          getCampaignsForUser(session.user.id),
          repositories.campaignMembers.listByUser(session.user.id),
        ]);
  const accessibleCampaignIds = new Set(
    accessibleCampaigns.map((campaign) => campaign.id),
  );
  const membershipByCampaignId = new Map(
    memberships.map((membership) => [membership.campaignId, membership]),
  );

  return (
    <main className="directory-page">
      <SiteHeader user={session.user} active="campaigns" />
      <div className="directory-frame">
        <header className="directory-heading">
          <div>
            <p className="campaign-kicker">Identidade confirmada · @{session.user.username}</p>
            <h1>{session.user.role === "admin" ? "Arquivo de campanhas" : "Campanhas"}</h1>
            <p>
              {session.user.role === "admin"
                ? "Você pode abrir e administrar qualquer campanha cadastrada."
                : "Solicite sua entrada na operação. Assim que o administrador aprovar, a ficha e todo o arquivo serão liberados."}
            </p>
          </div>
          <span className="directory-count">{campaigns.length.toString().padStart(2, "0")}</span>
        </header>

        {campaigns.length ? (
          <section className="directory-grid" aria-label="Campanhas disponíveis">
            {campaigns.map((campaign, index) => {
              const featured = index === 0 && campaigns.length === 1;
              return accessibleCampaignIds.has(campaign.id) ? (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  featured={featured}
                />
              ) : (
                <CampaignAccessCard
                  key={campaign.id}
                  campaign={campaign}
                  membershipStatus={
                    membershipByCampaignId.get(campaign.id)?.status ?? null
                  }
                  featured={featured}
                />
              );
            })}
          </section>
        ) : (
          <EmptyState
            eyebrow="Arquivo vazio"
            title="Nenhuma campanha foi publicada."
            description="Quando o administrador criar a primeira campanha, ela aparecerá aqui para solicitação."
          />
        )}
      </div>
    </main>
  );
}
