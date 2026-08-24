import type {
  Campaign,
  CampaignChapter,
  CampaignEvent,
  CampaignMember,
  CampaignSession,
  Character,
  CharacterClassOption,
  CharacterStatusOption,
  FileRelation,
  GameFile,
  Mission,
  MissionParticipant,
  SessionParticipant,
  Team,
  TeamMember,
  User,
  VirtualTable,
} from "@/domain/entities";
import type { Database } from "@/infrastructure/supabase/database.types";

export type TableName = keyof Database["public"]["Tables"];
export type TableRow<T extends TableName> =
  Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends TableName> =
  Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends TableName> =
  Database["public"]["Tables"][T]["Update"];

type ProfileLike = Omit<TableRow<"profiles">, "email"> & { email?: string };

export function mapUserRow(row: ProfileLike): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email ?? "",
    avatarUrl: row.avatar_url,
    role: row.role as User["role"],
    status: row.status as User["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignRow(row: TableRow<"campaigns">): Campaign {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    setting: row.setting,
    genre: row.genre,
    status: row.status as Campaign["status"],
    coverImageUrl: row.cover_image_url,
    coverImageStorageKey: row.cover_image_storage_key,
    backgroundImageUrl: row.background_image_url,
    backgroundImageStorageKey: row.background_image_storage_key,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    startDate: row.start_date,
    gameMasterUserId: row.game_master_user_id,
    storySummary: row.story_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignChapterRow(
  row: TableRow<"campaign_chapters">,
): CampaignChapter {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    backgroundImageUrl: row.background_image_url,
    backgroundImageStorageKey: row.background_image_storage_key,
    order: row.sort_order,
    status: row.status as CampaignChapter["status"],
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignMemberRow(
  row: TableRow<"campaign_members">,
): CampaignMember {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    role: row.role as CampaignMember["role"],
    status: row.status as CampaignMember["status"],
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCharacterStatusOptionRow(
  row: TableRow<"character_status_options">,
): CharacterStatusOption {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    order: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCharacterClassOptionRow(
  row: TableRow<"character_class_options">,
): CharacterClassOption {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logoImageUrl: row.logo_image_url,
    logoImageStorageKey: row.logo_image_storage_key,
    attributeBonuses: {
      physical: row.bonus_physical,
      agility: row.bonus_agility,
      marksmanship: row.bonus_marksmanship,
      perception: row.bonus_perception,
      technique: row.bonus_technique,
      control: row.bonus_control,
    },
    order: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCharacterRow(row: TableRow<"characters">): Character {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    gender: row.gender,
    statusOptionId: row.status_option_id,
    classOptionId: row.class_option_id,
    attributes: {
      physical: row.attribute_physical,
      agility: row.attribute_agility,
      marksmanship: row.attribute_marksmanship,
      perception: row.attribute_perception,
      technique: row.attribute_technique,
      control: row.attribute_control,
    },
    coverImageUrl: row.cover_image_url,
    coverImageStorageKey: row.cover_image_storage_key,
    backgroundImageUrl: row.background_image_url,
    backgroundImageStorageKey: row.background_image_storage_key,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    startDate: row.start_date,
    equipment: row.equipment,
    wounds: row.wounds,
    backpackItems: row.backpack_items,
    inventorySlots: row.inventory_slots,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTeamRow(row: TableRow<"teams">): Team {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTeamMemberRow(row: TableRow<"team_members">): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    characterId: row.character_id,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMissionRow(row: TableRow<"missions">): Mission {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    missionNumber: row.mission_number,
    imageUrl: row.image_url,
    description: row.description,
    briefing: row.briefing,
    primaryObjective: row.primary_objective,
    secondaryObjectives: row.secondary_objectives,
    status: row.status as Mission["status"],
    scheduledAt: row.scheduled_at,
    result: row.result,
    notes: row.notes,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMissionParticipantRow(
  row: TableRow<"mission_participants">,
): MissionParticipant {
  return {
    id: row.id,
    missionId: row.mission_id,
    characterId: row.character_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignSessionRow(
  row: TableRow<"campaign_sessions">,
): CampaignSession {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionNumber: row.session_number,
    title: row.title,
    status: row.status as CampaignSession["status"],
    scheduledAt: row.scheduled_at,
    occurredAt: row.occurred_at,
    summary: row.summary,
    description: row.description,
    events: row.events,
    consequences: row.consequences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSessionParticipantRow(
  row: TableRow<"session_participants">,
): SessionParticipant {
  return {
    id: row.id,
    sessionId: row.session_id,
    characterId: row.character_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignEventRow(
  row: TableRow<"campaign_events">,
): CampaignEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    type: row.type as CampaignEvent["type"],
    imageUrl: row.image_url,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGameFileRow(row: TableRow<"game_files">): GameFile {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    category: row.category as GameFile["category"],
    visibility: row.visibility as GameFile["visibility"],
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFileRelationRow(
  row: TableRow<"file_relations">,
): FileRelation {
  return {
    id: row.id,
    fileId: row.file_id,
    relationType: row.relation_type as FileRelation["relationType"],
    relationId: row.relation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVirtualTableRow(
  row: TableRow<"virtual_tables">,
  transition: VirtualTable["lastChapterTransition"] = null,
): VirtualTable {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    status: row.status as VirtualTable["status"],
    mapFileId: row.map_file_id,
    activeMapId: row.active_map_id,
    lastChapterTransition: transition,
    revision: row.revision,
    openedByUserId: row.opened_by_user_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
