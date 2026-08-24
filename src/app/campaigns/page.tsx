import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CampaignCard } from "@/components/campaigns/campaign-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentSession } from "@/lib/auth/current-user";
import { getCampaignDirectory, getCampaignsForUser } from "@/lib/campaign-data";

export const metadata: Metadata = {
  title: "Campanhas",
  description: "Campanhas disponíveis para o usuário atual do RPG Vitin.",
};
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=%2Fcampaigns");
  const campaigns = session.user.role === "admin"
    ? await getCampaignDirectory()
    : await getCampaignsForUser(session.user.id);

  return (
    <main className="directory-page">
      <SiteHeader user={session.user} active="campaigns" />
      <div className="directory-frame">
        <header className="directory-heading">
          <div>
            <p className="campaign-kicker">Identidade confirmada · @{session.user.username}</p>
            <h1>{session.user.role === "admin" ? "Arquivo de campanhas" : "Minhas campanhas"}</h1>
            <p>
              {session.user.role === "admin"
                ? "Você pode abrir e administrar qualquer campanha cadastrada."
                : "Apenas campanhas em que sua participação foi aprovada aparecem aqui."}
            </p>
          </div>
          <span className="directory-count">{campaigns.length.toString().padStart(2, "0")}</span>
        </header>

        {campaigns.length ? (
          <section className="directory-grid" aria-label="Campanhas disponíveis">
            {campaigns.map((campaign, index) => (
              <CampaignCard key={campaign.id} campaign={campaign} featured={index === 0 && campaigns.length === 1} />
            ))}
          </section>
        ) : (
          <EmptyState
            eyebrow="Nenhum acesso liberado"
            title="Você ainda não participa de uma campanha."
            description="Quando o administrador aprovar seu acesso, a campanha aparecerá aqui automaticamente."
          />
        )}
      </div>
    </main>
  );
}
