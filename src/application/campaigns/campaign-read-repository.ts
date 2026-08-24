import type {
  Campaign,
  CampaignChapter,
  CampaignEvent,
  CampaignMember,
  CampaignSession,
  Character,
  CharacterClassOption,
  CharacterStatusOption,
  EntityId,
  GameFile,
  Mission,
  Team,
  User,
} from "@/domain/entities";

export interface CampaignCardView {
  id: EntityId;
  name: string;
  slug: string;
  shortDescription: string;
  genre: string;
  status: Campaign["status"];
  coverImageUrl: string | null;
  backgroundImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  playerCount: number;
  updatedAt: string;
}

export interface CampaignMemberView {
  membership: CampaignMember;
  user: User | null;
}

export interface CampaignTeamView {
  team: Team;
  members: Character[];
}

export interface CampaignExperienceView {
  campaign: Campaign;
  openTableSessionId: EntityId | null;
  gameMaster: User | null;
  members: CampaignMemberView[];
  characters: Character[];
  chapters: CampaignChapter[];
  characterStatusOptions: CharacterStatusOption[];
  characterClassOptions: CharacterClassOption[];
  teams: CampaignTeamView[];
  missions: Mission[];
  sessions: CampaignSession[];
  events: CampaignEvent[];
  files: GameFile[];
}

export interface CampaignAccessView {
  campaign: Campaign;
  membership: CampaignMember | null;
}

/**
 * Read-side port tailored to the player experience. The local adapter builds
 * each view from one snapshot; a future SQL adapter can replace it with joins.
 */
export interface CampaignReadRepository {
  listCampaignCards(): Promise<CampaignCardView[]>;
  listCampaignCardsForUser(userId: EntityId): Promise<CampaignCardView[]>;
  findCampaignAccessBySlug(
    slug: string,
    userId: EntityId,
  ): Promise<CampaignAccessView | null>;
  findCampaignExperienceBySlug(
    slug: string,
  ): Promise<CampaignExperienceView | null>;
}
