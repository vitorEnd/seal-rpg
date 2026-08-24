import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignAccessPending } from "@/components/campaigns/campaign-access-pending";
import {
  campaignSections,
  isCampaignSection,
} from "@/components/campaigns/campaign-presenters";
import { CampaignSectionContent } from "@/components/campaigns/campaign-section-content";
import { CampaignShell } from "@/components/campaigns/campaign-shell";
import { getCampaignDirectory } from "@/lib/campaign-data";
import { loadCampaignPage } from "@/lib/campaign-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, section } = await params;
  const campaign = (await getCampaignDirectory()).find(
    (item) => item.slug === slug,
  );
  const sectionData = campaignSections.find((item) => item.id === section);

  if (!campaign || !sectionData || sectionData.id === "campaign") {
    return { title: "Arquivo não encontrado" };
  }

  return {
    title: `${sectionData.label} — ${campaign.name}`,
    description: `${sectionData.label} da campanha ${campaign.name}.`,
    openGraph: {
      title: `${sectionData.label} — ${campaign.name}`,
      description: `${sectionData.label} da campanha ${campaign.name}.`,
      images: campaign.coverImageUrl ? [campaign.coverImageUrl] : [],
    },
    twitter: {
      title: `${sectionData.label} — ${campaign.name}`,
      description: `${sectionData.label} da campanha ${campaign.name}.`,
      images: campaign.coverImageUrl ? [campaign.coverImageUrl] : [],
    },
  };
}

export default async function CampaignSectionPage({ params }: Props) {
  const { slug, section } = await params;
  if (!isCampaignSection(section)) {
    notFound();
  }

  const returnTo = `/campaigns/${encodeURIComponent(slug)}/${section}`;
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
      activeSection={section}
    >
      <CampaignSectionContent
        section={section}
        experience={context.experience}
        user={context.session.user}
      />
    </CampaignShell>
  );
}
