import type { Metadata } from "next";

import { CampaignAccessPending } from "@/components/campaigns/campaign-access-pending";
import { CampaignChapters } from "@/components/campaigns/campaign-chapters";
import { CampaignShell } from "@/components/campaigns/campaign-shell";
import { getCampaignDirectory } from "@/lib/campaign-data";
import { loadCampaignPage } from "@/lib/campaign-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = (await getCampaignDirectory()).find(
    (item) => item.slug === slug,
  );

  if (!campaign) {
    return { title: "Campanha não encontrada" };
  }

  return {
    title: campaign.name,
    description: campaign.shortDescription,
    openGraph: {
      title: campaign.name,
      description: campaign.shortDescription,
      images: campaign.coverImageUrl ? [campaign.coverImageUrl] : [],
    },
    twitter: {
      title: campaign.name,
      description: campaign.shortDescription,
      images: campaign.coverImageUrl ? [campaign.coverImageUrl] : [],
    },
  };
}

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const returnTo = `/campaigns/${encodeURIComponent(slug)}`;
  const context = await loadCampaignPage(slug, returnTo);

  if (context.kind === "pending") {
    return (
      <CampaignAccessPending
        campaign={context.campaign}
        user={context.session.user}
      />
    );
  }

  return (
    <CampaignShell
      experience={context.experience}
      user={context.session.user}
      membership={context.membership}
      activeSection="campaign"
    >
      <CampaignChapters experience={context.experience} user={context.session.user} />
    </CampaignShell>
  );
}
