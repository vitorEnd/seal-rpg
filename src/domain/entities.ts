import type { CharacterAttributes } from "@/domain/character-attributes";

export type EntityId = string;
export type ISODateString = string;

export interface EntityBase {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type UserRole = "admin" | "game_master" | "player";
export type UserStatus = "active" | "disabled";

export interface User extends EntityBase {
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export type CampaignStatus =
  | "draft"
  | "recruiting"
  | "active"
  | "paused"
  | "completed";

export interface Campaign extends EntityBase {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  setting: string;
  genre: string;
  status: CampaignStatus;
  coverImageUrl: string | null;
  coverImageStorageKey: string | null;
  backgroundImageUrl: string | null;
  backgroundImageStorageKey: string | null;
  primaryColor: string;
  secondaryColor: string;
  startDate: ISODateString | null;
  gameMasterUserId: EntityId | null;
  storySummary: string;
}

export type CampaignChapterStatus = "draft" | "published";

export interface CampaignChapter extends EntityBase {
  campaignId: EntityId;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  backgroundImageUrl: string | null;
  backgroundImageStorageKey: string | null;
  order: number;
  status: CampaignChapterStatus;
  completedAt: ISODateString | null;
}

export type CampaignMemberRole = "game_master" | "player";
export type CampaignMemberStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "removed";

export interface CampaignMember extends EntityBase {
  campaignId: EntityId;
  userId: EntityId;
  role: CampaignMemberRole;
  status: CampaignMemberStatus;
  joinedAt: ISODateString;
}

export interface CharacterStatusOption extends EntityBase {
  campaignId: EntityId;
  name: string;
  slug: string;
  color: string;
  order: number;
  active: boolean;
}

export interface CharacterClassOption extends EntityBase {
  campaignId: EntityId;
  name: string;
  slug: string;
  description: string;
  logoImageUrl: string | null;
  logoImageStorageKey: string | null;
  attributeBonuses: CharacterAttributes;
  order: number;
  active: boolean;
}

export interface Character extends EntityBase {
  campaignId: EntityId;
  userId: EntityId;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  gender: string;
  statusOptionId: EntityId;
  classOptionId: EntityId;
  attributes: CharacterAttributes;
  coverImageUrl: string | null;
  coverImageStorageKey: string | null;
  backgroundImageUrl: string | null;
  backgroundImageStorageKey: string | null;
  primaryColor: string;
  secondaryColor: string;
  startDate: ISODateString | null;
  equipment: string[];
  wounds: string[];
  backpackItems: string[];
  inventorySlots: number;
}

export interface Team extends EntityBase {
  campaignId: EntityId;
  name: string;
  description: string;
  imageUrl: string | null;
  order: number;
}

export interface TeamMember extends EntityBase {
  teamId: EntityId;
  characterId: EntityId;
  order: number;
}

export type MissionStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed"
  | "failed";

export interface Mission extends EntityBase {
  campaignId: EntityId;
  name: string;
  missionNumber: number;
  imageUrl: string | null;
  description: string;
  briefing: string;
  primaryObjective: string;
  secondaryObjectives: string[];
  status: MissionStatus;
  scheduledAt: ISODateString | null;
  result: string;
  notes: string;
  order: number;
}

export interface MissionParticipant extends EntityBase {
  missionId: EntityId;
  characterId: EntityId;
}

export interface CampaignSession extends EntityBase {
  campaignId: EntityId;
  sessionNumber: number;
  title: string;
  status: "scheduled" | "completed" | "cancelled";
  scheduledAt: ISODateString | null;
  occurredAt: ISODateString | null;
  summary: string;
  description: string;
  events: string;
  consequences: string;
}

export type VirtualTableStatus = "open" | "closed";

export interface VirtualTableChapterTransition {
  id: EntityId;
  fromChapterId: EntityId;
  toChapterId: EntityId | null;
  mapId: EntityId | null;
  occurredAt: ISODateString;
}

export interface VirtualTable extends EntityBase {
  campaignId: EntityId;
  sessionId: EntityId;
  status: VirtualTableStatus;
  mapFileId: EntityId | null;
  activeMapId: EntityId | null;
  lastChapterTransition: VirtualTableChapterTransition | null;
  revision: number;
  openedByUserId: EntityId;
  openedAt: ISODateString;
  closedAt: ISODateString | null;
}

export type VirtualTableTokenKind = "character" | "npc" | "enemy" | "object";
export type VirtualTableTokenDisposition =
  | "player"
  | "ally"
  | "neutral"
  | "hostile"
  | "object";

export type VirtualTableMapScale = "medium" | "large" | "huge";

export interface VirtualTableMap extends EntityBase {
  campaignId: EntityId;
  name: string;
  description: string;
  groupName: string;
  layerName: string;
  imageFileId: EntityId | null;
  builtInImageUrl: string | null;
  scale: VirtualTableMapScale;
  builtIn: boolean;
  order: number;
  createdByUserId: EntityId | null;
}

export interface VirtualTableToken extends EntityBase {
  tableId: EntityId;
  mapId: EntityId | null;
  name: string;
  kind: VirtualTableTokenKind;
  characterId: EntityId | null;
  imageFileId: EntityId | null;
  x: number;
  y: number;
  size: number;
  zIndex: number;
  visible: boolean;
  disposition: VirtualTableTokenDisposition;
  accentColor: string;
  notes: string;
  collectible: boolean;
  rotation: number;
  visionEnabled: boolean;
  visionAngle: number;
  visionRange: number;
  visionColor: string;
}

export interface DiceRoll extends EntityBase {
  tableId: EntityId;
  campaignId: EntityId;
  sessionId: EntityId;
  userId: EntityId;
  actorName: string;
  expression: string;
  diceValues: number[];
  modifier: number;
  total: number;
}

export interface SessionParticipant extends EntityBase {
  sessionId: EntityId;
  characterId: EntityId;
}

export type CampaignEventType =
  | "mission_started"
  | "mission_completed"
  | "character_injured"
  | "character_deceased"
  | "location_discovered"
  | "document_found"
  | "narrative"
  | "other";

export interface CampaignEvent extends EntityBase {
  campaignId: EntityId;
  title: string;
  description: string;
  occurredAt: ISODateString;
  type: CampaignEventType;
  imageUrl: string | null;
  order: number;
}

export type ContentVisibility =
  | "public"
  | "members"
  | "game_master"
  | "admin";

export type FileCategory =
  | "intel"
  | "map"
  | "briefing"
  | "report"
  | "image"
  | "other";

export interface GameFile extends EntityBase {
  campaignId: EntityId;
  name: string;
  description: string;
  category: FileCategory;
  visibility: ContentVisibility;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

export type FileRelationType = "mission" | "session" | "character";

export interface FileRelation extends EntityBase {
  fileId: EntityId;
  relationType: FileRelationType;
  relationId: EntityId;
}
