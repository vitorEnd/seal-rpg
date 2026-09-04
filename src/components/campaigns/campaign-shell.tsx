import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import {
  campaignSections,
  campaignStatusLabel,
  campaignThemeStyle,
  type CampaignSectionId,
} from "@/components/campaigns/campaign-presenters";
import { OperationMenu } from "@/components/campaigns/operation-menu";
import { SgioMenu } from "@/components/campaigns/sgio-menu";
import { TacticalScrambleText } from "@/components/effects/tactical-scramble-text";
import { SiteHeader } from "@/components/site/site-header";
import { usesSgioRules } from "@/domain/campaign-rules";
import type { CampaignMember, User } from "@/domain/entities";

const sgioModuleBriefs: Record<CampaignSectionId, string> = {
  campaign: "Protocolos ativos, capítulos e acesso à próxima intervenção.",
  overview: "Mandato institucional, origem do caso e parâmetros da ameaça.",
  sheet: "Registro biológico, capacidades e identidade dos agentes convocados.",
  sessions: "Linha de memória compartilhada das operações do esquadrão.",
};

export function CampaignShell({
  experience,
  user,
  membership,
  activeSection,
  children,
}: {
  experience: CampaignExperienceView;
  user: User;
  membership: CampaignMember | null;
  activeSection: CampaignSectionId;
  children: ReactNode;
}) {
  const { campaign } = experience;
  const isSgio = usesSgioRules(campaign.slug);
  const [firstWord, ...remainingWords] = campaign.name.split(/\s+/);
  const activeSectionData = campaignSections.find(
    (section) => section.id === activeSection,
  );
  const accessLabel =
    user.role === "admin"
      ? "Administrador"
      : membership?.role === "game_master" || campaign.gameMasterUserId === user.id
        ? "Mestre"
        : "Jogador";

  return (
    <main
      className={`campaign-screen ${isSgio ? "campaign-screen--sgio" : ""}`}
      data-campaign-theme={isSgio ? "sgio" : "neptune"}
      style={campaignThemeStyle(campaign.primaryColor, campaign.secondaryColor)}
    >
      <section className="campaign-menu-hero" aria-labelledby="campaign-title">
        <div className="campaign-hero-media" aria-hidden="true">
          {campaign.backgroundImageUrl ? (
            <Image
              src={campaign.backgroundImageUrl}
              alt=""
              fill
              unoptimized={campaign.backgroundImageUrl.startsWith("/media/")}
              priority
              sizes="100vw"
              className="campaign-hero-image object-cover"
            />
          ) : null}
          <div className="campaign-hero-shade" />
          {isSgio ? (
            <>
              <div className="sgio-hero-shards" />
              <div className="sgio-hero-energy-column" />
              <div className="sgio-hero-signal" />
            </>
          ) : (
            <div className="campaign-dust" />
          )}
          <div className="campaign-scanlines" />
        </div>

        <SiteHeader user={user} active="campaigns" overlay />

        {isSgio ? (
          <div className="sgio-stage">
            <div className="sgio-stage-topline" aria-hidden="true">
              <span>GHOSTNET // VERDRUM</span>
              <div>
                <i /> Unidade extraordinária
              </div>
              <strong>Canal 07-A</strong>
            </div>

            <div className="sgio-title-block">
              <p className="campaign-classification">
                Secretaria de intervenções ocultas <span>·</span>
                {campaignStatusLabel(campaign.status)}
              </p>
              <h1 id="campaign-title">
                <span>S.G.I.O.</span>
                <strong>Soldados Fantasmas</strong>
                <small>de Verdrum</small>
              </h1>
              <p className="campaign-setting">{campaign.setting}</p>
              <div className="sgio-title-metrics" aria-label="Estado da operação">
                <span><small>Agentes</small><strong>{String(experience.characters.length).padStart(2, "0")}</strong></span>
                <span><small>Capítulos</small><strong>{String(experience.chapters.length).padStart(2, "0")}</strong></span>
                <span><small>Ameaça</small><strong>ÔMEGA</strong></span>
              </div>
            </div>

            <aside className="sgio-active-module">
              <span>Módulo selecionado</span>
              <small>
                {activeSectionData?.number ?? "--"} {"// acesso autorizado"}
              </small>
              <strong>{activeSectionData?.label ?? "Arquivo"}</strong>
              <p>{sgioModuleBriefs[activeSection]}</p>
              <i aria-hidden="true" />
            </aside>

            <SgioMenu
              campaignSlug={campaign.slug}
              campaignName={campaign.name}
              activeSection={activeSection}
            />

            <div className="sgio-access-rail">
              <span><small>Credencial</small>{accessLabel}</span>
              <span><small>Agente</small>@{user.username}</span>
              {user.role === "admin" ? (
                <Link href="/admin">Central administrativa <i aria-hidden="true">↗</i></Link>
              ) : (
                <span><small>Estado</small>Conectado</span>
              )}
            </div>
          </div>
        ) : (
          <div className="campaign-menu-layout">
            <div className="campaign-title-block">
              <p className="campaign-classification">
                Arquivo restrito <span>·</span> {campaignStatusLabel(campaign.status)}
              </p>
              <h1 id="campaign-title">
                <TacticalScrambleText text={firstWord} delay={120} />
                {remainingWords.length ? (
                  <TacticalScrambleText
                    text={remainingWords.join(" ")}
                    as="strong"
                    delay={280}
                  />
                ) : null}
              </h1>
              <p className="campaign-setting">{campaign.setting}</p>
            </div>
            <OperationMenu
              campaignSlug={campaign.slug}
              campaignName={campaign.name}
              activeSection={activeSection}
            />

          <div className="campaign-access-strip">
            <span>Acesso: {accessLabel}</span>
            <span>Codinome: @{user.username}</span>
            {user.role === "admin" ? (
              <Link href="/admin">Abrir central administrativa</Link>
            ) : null}
          </div>
          </div>
        )}

        <a href="#campaign-content" className="campaign-scroll-cue">
          <span>Explorar seção</span>
          <i aria-hidden="true">↓</i>
        </a>
      </section>

      <div
        id="campaign-content"
        className="campaign-content-anchor"
        role="region"
        tabIndex={-1}
        aria-label={`Conteúdo: ${campaignSections.find((section) => section.id === activeSection)?.label}`}
      >
        <div className="campaign-content-frame">{children}</div>
      </div>

      <footer className="campaign-footer">
        <p>RPG Vitin · arquivo privado de campanha</p>
        <Link href="/campaigns">Voltar às campanhas</Link>
      </footer>
    </main>
  );
}
