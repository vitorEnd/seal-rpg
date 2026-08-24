import type { Metadata } from "next";

import { CampaignAccessPending } from "@/components/campaigns/campaign-access-pending";
import { TableLobby } from "@/components/tabletop/table-lobby";
import { VirtualTable } from "@/components/tabletop/virtual-table";
import { canManageCampaign } from "@/domain/permissions";
import { getCampaignDirectory } from "@/lib/campaign-data";
import { loadCampaignPage } from "@/lib/campaign-page";
import { tabletopReadRepository } from "@/lib/container";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = (await getCampaignDirectory()).find(
    (item) => item.slug === slug,
  );

  if (!campaign) return { title: "Mesa não encontrada" };

  return {
    title: `Mesa virtual — ${campaign.name}`,
    description: `Mapa compartilhado e rolagens da campanha ${campaign.name}.`,
  };
}

export default async function VirtualTablePage({ params }: Props) {
  const { slug } = await params;
  const returnTo = `/campaigns/${encodeURIComponent(slug)}/table`;
  const context = await loadCampaignPage(slug, returnTo);

  if (context.kind === "pending") {
    return (
      <CampaignAccessPending
        campaign={context.campaign}
        user={context.session.user}
      />
    );
  }

  const { campaign } = context.experience;
  const canManage = canManageCampaign(
    context.session.user,
    campaign,
    context.membership,
  );
  const snapshot = await tabletopReadRepository.findOpenSnapshotByCampaignSlug(
    campaign.slug,
    {
      includeHiddenTokens: canManage,
      includeLockedChapterDetails: canManage,
    },
  );

  if (!snapshot) {
    return (
      <TableLobby
        campaign={{
          name: campaign.name,
          slug: campaign.slug,
          backgroundImageUrl: campaign.backgroundImageUrl,
        }}
        viewerName={context.session.user.name}
        canManage={canManage}
        scheduledSessions={context.experience.sessions
          .filter((session) => session.status === "scheduled")
          .sort(
            (left, right) =>
              (left.scheduledAt ?? left.createdAt).localeCompare(
                right.scheduledAt ?? right.createdAt,
              ) || left.sessionNumber - right.sessionNumber,
          )
          .map((session) => ({
            id: session.id,
            sessionNumber: session.sessionNumber,
            title: session.title,
          }))}
      />
    );
  }

  return (
    <VirtualTable
      initialSnapshot={snapshot}
      viewer={{
        id: context.session.user.id,
        name: context.session.user.name,
        username: context.session.user.username,
      }}
      canManage={canManage}
    />
  );
}
