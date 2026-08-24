import Link from "next/link";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import { formatDate } from "@/components/campaigns/campaign-presenters";
import { TacticalGlobe } from "@/components/campaigns/tactical-globe";
import type { User } from "@/domain/entities";

export function CampaignOverview({
  experience,
  user,
}: {
  experience: CampaignExperienceView;
  user: User;
}) {
  const { campaign } = experience;
  const campaignYear =
    campaign.startDate?.slice(0, 4) ??
    campaign.setting.match(/\b(?:19|20)\d{2}\b/)?.[0] ??
    "ARQ";
  return (
    <section className="campaign-content-section overview-section" aria-labelledby="overview-title">
      <header className="campaign-section-heading narrative-heading">
        <div>
          <p className="campaign-kicker">Dossiê da operação</p>
          <h2 id="overview-title">Visão geral</h2>
        </div>
        {user.role === "admin" ? (
          <Link href="/admin?view=campaigns" className="campaign-text-link">
            Editar informações
          </Link>
        ) : null}
      </header>

      <div className="overview-layout">
        <article className="overview-narrative">
          <span className="overview-index">{campaignYear}</span>
          <p className="overview-lead">{campaign.shortDescription}</p>
          <p>{campaign.description}</p>
          {campaign.storySummary ? (
            <blockquote>{campaign.storySummary}</blockquote>
          ) : null}
        </article>

        <aside className="overview-facts">
          <dl>
            <div>
              <dt>Teatro de operações</dt>
              <dd>{campaign.setting}</dd>
            </div>
            <div>
              <dt>Sistema / gênero</dt>
              <dd>{campaign.genre}</dd>
            </div>
            <div>
              <dt>Início da campanha</dt>
              <dd>{formatDate(campaign.startDate)}</dd>
            </div>
            <div>
              <dt>Comando da mesa</dt>
              <dd>{experience.gameMaster?.name ?? "A definir"}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {campaign.slug === "operacao-neptune" ? (
        <TacticalGlobe campaignName={campaign.name} />
      ) : null}
    </section>
  );
}
