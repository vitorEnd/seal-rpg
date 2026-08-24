import type {
  Campaign,
  CampaignChapter,
  CampaignMember,
  Character,
  CharacterClassOption,
  GameFile,
  User,
} from "@/domain/entities";
import { resolveCampaignChapterProgression } from "@/domain/chapter-progression";
import {
  canManageCampaign,
  canViewCampaign,
  canViewContent,
} from "@/domain/permissions";

export type CampaignMediaReference =
  | { kind: "campaign-public" }
  | { kind: "campaign-private" }
  | { kind: "campaign-draft" }
  | { kind: "file"; file: GameFile }
  | { kind: "unknown" };

export function classifyCampaignMediaReference({
  storageKey,
  campaign,
  chapters,
  characters,
  classOptions = [],
  files,
}: {
  storageKey: string;
  campaign: Campaign;
  chapters: CampaignChapter[];
  characters: Character[];
  classOptions?: CharacterClassOption[];
  files: GameFile[];
}): CampaignMediaReference {
  if (
    campaign.coverImageStorageKey === storageKey ||
    campaign.backgroundImageStorageKey === storageKey
  ) {
    return { kind: "campaign-public" };
  }
  const chapter = chapters.find(
    (item) => item.backgroundImageStorageKey === storageKey,
  );
  if (chapter) {
    const progressState = resolveCampaignChapterProgression(chapters).entries.find(
      (entry) => entry.chapter.id === chapter.id,
    )?.state;
    return {
      kind:
        chapter.status === "published" && progressState !== "locked"
          ? "campaign-private"
          : "campaign-draft",
    };
  }
  if (
    characters.some(
      (character) =>
        character.coverImageStorageKey === storageKey ||
        character.backgroundImageStorageKey === storageKey,
    )
  ) {
    return { kind: "campaign-private" };
  }
  if (
    classOptions.some(
      (characterClass) => characterClass.logoImageStorageKey === storageKey,
    )
  ) {
    return { kind: "campaign-private" };
  }
  const file = files.find((item) => item.storageKey === storageKey);
  return file ? { kind: "file", file } : { kind: "unknown" };
}

export function canReadCampaignMedia(
  reference: CampaignMediaReference,
  campaign: Campaign,
  user: User | null,
  membership: CampaignMember | null,
): boolean {
  if (reference.kind === "unknown") return false;
  if (reference.kind === "campaign-public") return true;
  if (reference.kind === "file" && reference.file.visibility === "public") {
    return true;
  }
  if (!user || !canViewCampaign(user, campaign, membership)) return false;
  if (reference.kind === "campaign-private") return true;
  if (reference.kind === "campaign-draft") {
    return canManageCampaign(user, campaign, membership);
  }
  return (
    canManageCampaign(user, campaign, membership) ||
    canViewContent(reference.file.visibility, user, membership)
  );
}
