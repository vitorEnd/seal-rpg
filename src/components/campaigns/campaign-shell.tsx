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
              <div className="sgio-hero-grid" />
              <div className="sgio-hero-sweep" />
              <div className="sgio-hero-reticle" />
            </>
          ) : (
            <div className="campaign-dust" />
          )}
          <div className="campaign-scanlines" />
        </div>

        <SiteHeader user={user} active="campaigns" overlay />

        <div className={`campaign-menu-layout ${isSgio ? "sgio-menu-layout" : ""}`}>
          {isSgio ? (
            <div className="sgio-title-block">
              <p className="campaign-classification">
                Secretaria de intervenções ocultas <span>·</span>{" "}
                {campaignStatusLabel(campaign.status)}
              </p>
              <h1 id="campaign-title">
                <span>S.G.I.O.</span>
                <strong>Soldados Fantasmas</strong>
                <small>de Verdrum</small>
              </h1>
              <p className="campaign-setting">{campaign.setting}</p>
            </div>
          ) : (
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
          )}

          {isSgio ? (
            <SgioMenu
              campaignSlug={campaign.slug}
              campaignName={campaign.name}
              activeSection={activeSection}
            />
          ) : (
            <OperationMenu
              campaignSlug={campaign.slug}
              campaignName={campaign.name}
              activeSection={activeSection}
            />
          )}

          <div className="campaign-access-strip">
            <span>{isSgio ? "Credencial" : "Acesso"}: {accessLabel}</span>
            <span>{isSgio ? "Agente" : "Codinome"}: @{user.username}</span>
            {user.role === "admin" ? (
              <Link href="/admin">Abrir central administrativa</Link>
            ) : null}
          </div>
        </div>

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
