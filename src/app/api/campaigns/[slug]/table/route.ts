import { NextResponse } from "next/server";

import { canManageCampaign, canViewCampaign } from "@/domain/permissions";
import { getCurrentSession } from "@/lib/auth/current-user";
import {
  repositories,
  tabletopReadRepository,
} from "@/lib/container";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const authSession = await getCurrentSession();
  if (!authSession) {
    return new NextResponse(null, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const { slug } = await params;
  const campaign = await repositories.campaigns.findBySlug(slug);
  if (!campaign) {
    return new NextResponse(null, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const membership = await repositories.campaignMembers.findMembership(
    campaign.id,
    authSession.user.id,
  );
  if (!canViewCampaign(authSession.user, campaign, membership)) {
    return new NextResponse(null, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const canManage = canManageCampaign(authSession.user, campaign, membership);
  const snapshot = await tabletopReadRepository.findOpenSnapshotByCampaignSlug(
    campaign.slug,
    {
      includeHiddenTokens: canManage,
      includeLockedChapterDetails: canManage,
    },
  );
  if (!snapshot) {
    return NextResponse.json(
      { snapshot: null },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    { snapshot },
    { headers: PRIVATE_NO_STORE_HEADERS },
  );
}
