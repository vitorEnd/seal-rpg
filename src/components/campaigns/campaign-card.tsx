import Image from "next/image";
import Link from "next/link";

import type { CampaignCardView } from "@/application/campaigns/campaign-read-repository";
import {
  campaignInitials,
  campaignStatusLabel,
  campaignThemeStyle,
} from "@/components/campaigns/campaign-presenters";

export function CampaignCard({
  campaign,
  featured = false,
  ctaLabel = "Abrir campanha",
}: {
  campaign: CampaignCardView;
  featured?: boolean;
  ctaLabel?: string;
}) {
  const imageUrl = campaign.coverImageUrl ?? campaign.backgroundImageUrl;
  return (
    <Link
      href={`/campaigns/${encodeURIComponent(campaign.slug)}`}
      className={`archive-card ${featured ? "featured" : ""}`}
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
              sizes={featured ? "(min-width: 1024px) 70vw, 100vw" : "(min-width: 768px) 50vw, 100vw"}
              className="object-cover"
            />
          ) : (
            <span className="archive-card-initials" aria-hidden="true">{campaignInitials(campaign.name)}</span>
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
            <span>{campaign.playerCount.toString().padStart(2, "0")} jogadores</span>
            <strong>{ctaLabel} <i aria-hidden="true">→</i></strong>
          </div>
        </div>
      </article>
    </Link>
  );
}
