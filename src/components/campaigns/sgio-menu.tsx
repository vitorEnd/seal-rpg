import Link from "next/link";

import {
  campaignSections,
  type CampaignSectionId,
} from "@/components/campaigns/campaign-presenters";

const sectionProfiles: Record<
  CampaignSectionId,
  { code: string; eyebrow: string; description: string }
> = {
  campaign: {
    code: "ARC",
    eyebrow: "Protocolos e capítulos",
    description: "Acompanhe a operação em curso.",
  },
  overview: {
    code: "BRF",
    eyebrow: "Origem, ameaça e mandato",
    description: "Leia o dossiê da organização.",
  },
  sheet: {
    code: "AGT",
    eyebrow: "Monte seu agente",
    description: "Registre identidade e capacidades.",
  },
  sessions: {
    code: "MEM",
    eyebrow: "Memórias de campo",
    description: "Consulte incursões e registros.",
  },
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
    <nav className="sgio-command-menu" aria-label={`Módulos de ${campaignName}`}>
      <div className="sgio-command-heading">
        <div>
          <span>GHOST DECK // 04 MÓDULOS</span>
          <strong>Selecione um protocolo</strong>
        </div>
        <p>
          <i aria-hidden="true" /> Sincronização ativa
        </p>
      </div>

      <div className="sgio-command-tabs">
        {campaignSections.map((section, index) => {
          const profile = sectionProfiles[section.id];
          const isActive = activeSection === section.id;
          return (
            <Link
              key={section.id}
              href={`/campaigns/${encodeURIComponent(campaignSlug)}${section.path}#campaign-content`}
              aria-current={isActive ? "page" : undefined}
              className="sgio-command-item"
            >
              <span className="sgio-command-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="sgio-command-copy">
                <small>{profile.eyebrow}</small>
                <strong>{section.label}</strong>
                <em>{profile.description}</em>
              </span>
              <span className="sgio-command-signal" aria-hidden="true">
                <b>{profile.code}</b>
                <i />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
