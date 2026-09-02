import Link from "next/link";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import { formatDate } from "@/components/campaigns/campaign-presenters";
import { TacticalGlobe } from "@/components/campaigns/tactical-globe";
import { usesSgioRules } from "@/domain/campaign-rules";
import type { User } from "@/domain/entities";

export function CampaignOverview({
  experience,
  user,
}: {
  experience: CampaignExperienceView;
  user: User;
}) {
  const { campaign } = experience;
  const isSgio = usesSgioRules(campaign.slug);
  const campaignYear =
    campaign.startDate?.slice(0, 4) ??
    campaign.setting.match(/\b(?:19|20)\d{2}\b/)?.[0] ??
    "ARQ";
  return (
    <section className="campaign-content-section overview-section" aria-labelledby="overview-title">
      <header className="campaign-section-heading narrative-heading">
        <div>
          <p className="campaign-kicker">
            {isSgio ? "Diretiva de intervenção oculta" : "Dossiê da operação"}
          </p>
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
              <dt>{isSgio ? "Zona de intervenção" : "Teatro de operações"}</dt>
              <dd>{campaign.setting}</dd>
            </div>
            <div>
              <dt>{isSgio ? "Classificação" : "Sistema / gênero"}</dt>
              <dd>{campaign.genre}</dd>
            </div>
            <div>
              <dt>Início da campanha</dt>
              <dd>{formatDate(campaign.startDate)}</dd>
            </div>
            <div>
              <dt>{isSgio ? "Diretor da operação" : "Comando da mesa"}</dt>
              <dd>{experience.gameMaster?.name ?? "A definir"}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {campaign.slug === "operacao-neptune" ? (
        <TacticalGlobe campaignName={campaign.name} />
      ) : null}

      {isSgio ? (
        <div className="sgio-directive-grid" aria-label="Protocolos da S.G.I.O.">
          <article>
            <span>01</span>
            <div>
              <small>Mandato</small>
              <strong>Investigar o impossível</strong>
              <p>Rastrear fenômenos que não podem chegar ao conhecimento público.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <small>Protocolo</small>
              <strong>Conter a anomalia</strong>
              <p>Preservar vidas, evidências e os segredos mantidos pela organização.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <small>Ameaça inicial</small>
              <strong>Predador adaptativo</strong>
              <p>Uma criação biomecânica aprende, modifica o próprio corpo e se recusa a morrer.</p>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
