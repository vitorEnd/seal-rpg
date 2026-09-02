"use client";

import Image from "next/image";
import { useActionState } from "react";

import { requestCampaignAccessAction } from "@/app/campaigns/actions";
import type { CampaignCardView } from "@/application/campaigns/campaign-read-repository";
import { initialMutationState } from "@/application/forms/mutation-state";
import {
  campaignInitials,
  campaignStatusLabel,
  campaignThemeStyle,
} from "@/components/campaigns/campaign-presenters";
import { ActionFeedback, SubmitButton } from "@/components/forms/action-ui";
import { usesSgioRules } from "@/domain/campaign-rules";
import type { CampaignMemberStatus } from "@/domain/entities";

export function CampaignAccessCard({
  campaign,
  membershipStatus,
  featured = false,
}: {
  campaign: CampaignCardView;
  membershipStatus: CampaignMemberStatus | null;
  featured?: boolean;
}) {
  const [state, formAction] = useActionState(
    requestCampaignAccessAction,
    initialMutationState,
  );
  const imageUrl = campaign.coverImageUrl ?? campaign.backgroundImageUrl;
  const isPending = membershipStatus === "pending";
  const isSgio = usesSgioRules(campaign.slug);

  return (
    <div
      className={`archive-card campaign-access-card ${isSgio ? "archive-card--sgio" : ""} ${featured ? "featured" : ""}`}
      data-campaign-theme={isSgio ? "sgio" : "neptune"}
      style={campaignThemeStyle(campaign.primaryColor, campaign.secondaryColor)}
    >
      <article>
        <div className="archive-card-art">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`Arte da campanha ${campaign.name}`}
              fill
              unoptimized={imageUrl.startsWith("/media/")}
              sizes={
                featured
                  ? "(min-width: 1024px) 70vw, 100vw"
                  : "(min-width: 768px) 50vw, 100vw"
              }
              className="object-cover"
            />
          ) : (
            <span className="archive-card-initials" aria-hidden="true">
              {campaignInitials(campaign.name)}
            </span>
          )}
          <div className="archive-card-shade" />
          <div className="archive-card-topline">
            <span>{campaign.genre}</span>
            <span>{campaignStatusLabel(campaign.status)}</span>
          </div>
          <div className="archive-card-title">
            <p>Arquivo de campanha</p>
            <h3>{campaign.name}</h3>
          </div>
        </div>

        <div className="archive-card-copy">
          <p>{campaign.shortDescription}</p>
          <div>
            <span>
              {campaign.playerCount.toString().padStart(2, "0")} jogadores
            </span>
            {isPending ? (
              <p className="campaign-access-status" role="status">
                <i aria-hidden="true" />
                Aguardando aprovação do administrador
              </p>
            ) : (
              <form action={formAction} className="campaign-access-form">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <input
                  type="hidden"
                  name="campaignSlug"
                  value={campaign.slug}
                />
                <SubmitButton
                  className="campaign-access-button"
                  pendingLabel="Enviando solicitação..."
                >
                  Solicitar acesso <i aria-hidden="true">→</i>
                </SubmitButton>
                <ActionFeedback state={state} />
              </form>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
