import Link from "next/link";

import {
  campaignSections,
  type CampaignSectionId,
} from "@/components/campaigns/campaign-presenters";

const sectionProtocols: Record<CampaignSectionId, string> = {
  campaign: "Arquivo central",
  overview: "Briefing sigiloso",
  sheet: "Registro de agente",
  sessions: "Memória operacional",
};

export function SgioMenu({
  campaignSlug,
  campaignName,
  activeSection,
}: {
  campaignSlug: string;
  campaignName: string;
  activeSection: CampaignSectionId;
}) {
  return (
    <nav className="sgio-command-menu" aria-label={`Terminal de ${campaignName}`}>
      <header>
        <div>
          <span aria-hidden="true">SGIO//GHOSTNET</span>
          <strong>Terminal de intervenção</strong>
        </div>
        <p>
          <i aria-hidden="true" /> Canal protegido
        </p>
      </header>

      <div className="sgio-command-grid">
        {campaignSections.map((section) => (
          <Link
            key={section.id}
            href={`/campaigns/${encodeURIComponent(campaignSlug)}${section.path}#campaign-content`}
            aria-current={activeSection === section.id ? "page" : undefined}
            className="sgio-command-item"
          >
            <span aria-hidden="true">{section.number}</span>
            <div>
              <small>{sectionProtocols[section.id]}</small>
              <strong>{section.label}</strong>
            </div>
            <i aria-hidden="true">↗</i>
          </Link>
        ))}
      </div>

      <footer aria-hidden="true">
        <span>Investigação</span>
        <span>Contenção</span>
        <span>Intervenção</span>
      </footer>
    </nav>
  );
}
