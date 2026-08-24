import "server-only";

import { notFound, redirect } from "next/navigation";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import type { AuthSession } from "@/application/auth/auth-provider";
import type { Campaign, CampaignMember } from "@/domain/entities";
import { canViewCampaign } from "@/domain/permissions";
import { getCurrentSession } from "@/lib/auth/current-user";
import { getCampaignAccess, getCampaignExperience } from "@/lib/campaign-data";

export type CampaignPageContext =
  | {
      kind: "allowed";
      session: AuthSession;
      experience: CampaignExperienceView;
      membership: CampaignMember | null;
      requestedAt: string;
    }
  | {
      kind: "pending";
      session: AuthSession;
      campaign: Campaign;
      membership: CampaignMember;
    };

export async function loadCampaignPage(
  slug: string,
  returnTo: string,
): Promise<CampaignPageContext> {
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  const access = await getCampaignAccess(slug, session.user.id);
  if (!access) {
    notFound();
  }

  if (
    access.membership?.status === "pending" &&
    session.user.role !== "admin" &&
    access.campaign.gameMasterUserId !== session.user.id
  ) {
    return {
      kind: "pending",
      session,
      campaign: access.campaign,
      membership: access.membership,
    };
  }

  if (!canViewCampaign(session.user, access.campaign, access.membership)) {
    redirect("/access-denied");
  }

  const experience = await getCampaignExperience(slug);
  if (!experience) {
    notFound();
  }

  return {
    kind: "allowed",
    session,
    experience,
    membership: access.membership,
    requestedAt: new Date().toISOString(),
  };
}
