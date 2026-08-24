import "server-only";

import { cache } from "react";

import { campaignReadRepository } from "@/lib/container";

export const getCampaignDirectory = cache(() =>
  campaignReadRepository.listCampaignCards(),
);

export const getCampaignsForUser = cache((userId: string) =>
  campaignReadRepository.listCampaignCardsForUser(userId),
);

export const getCampaignAccess = cache((slug: string, userId: string) =>
  campaignReadRepository.findCampaignAccessBySlug(slug, userId),
);

export const getCampaignExperience = cache((slug: string) =>
  campaignReadRepository.findCampaignExperienceBySlug(slug),
);
