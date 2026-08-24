import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import { CampaignOverview } from "@/components/campaigns/campaign-overview";
import type { CampaignSectionId } from "@/components/campaigns/campaign-presenters";
import { CampaignSessions } from "@/components/campaigns/campaign-sessions";
import { CharacterSheetSection } from "@/components/campaigns/character-sheet-section";
import type { User } from "@/domain/entities";

export function CampaignSectionContent({
  section,
  experience,
  user,
}: {
  section: Exclude<CampaignSectionId, "campaign">;
  experience: CampaignExperienceView;
  user: User;
}) {
  if (section === "overview") return <CampaignOverview experience={experience} user={user} />;
  if (section === "sheet") return <CharacterSheetSection experience={experience} user={user} />;
  return <CampaignSessions experience={experience} user={user} />;
}
