import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type {
  Campaign,
  CampaignChapter,
  CampaignEvent,
  CampaignMember,
  CampaignSession,
  Character,
  CharacterClassOption,
  CharacterStatusOption,
  EntityBase,
  EntityId,
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
import {
  isValidCharacterAttributeBonuses,
  isValidCharacterAttributes,
} from "@/domain/character-attributes";
import type {
  CampaignChapterRepository,
  CampaignEventRepository,
  CampaignMemberRepository,
  CampaignRepository,
  CampaignSessionRepository,
  CharacterClassOptionRepository,
  CharacterRepository,
  CharacterStatusOptionRepository,
  CreateEntityInput,
  CrudRepository,
  DashboardSummaryRepository,
  FileRelationRepository,
  FileRepository,
  MissionParticipantRepository,
  MissionRepository,
  RepositoryRegistry,
  SessionParticipantRepository,
  TabletopRepository,
  TeamMemberRepository,
  TeamRepository,
  UpdateEntityInput,
  UserRepository,
} from "@/domain/repositories";
import { RepositoryConflictError } from "@/domain/repositories";
import type { Database, Json } from "@/infrastructure/supabase/database.types";
import {
  mapCampaignChapterRow,
  mapCampaignEventRow,
  mapCampaignMemberRow,
  mapCampaignRow,
  mapCampaignSessionRow,
  mapCharacterClassOptionRow,
  mapCharacterRow,
  mapCharacterStatusOptionRow,
  mapFileRelationRow,
  mapGameFileRow,
  mapMissionParticipantRow,
  mapMissionRow,
  mapSessionParticipantRow,
  mapTeamMemberRow,
  mapTeamRow,
  mapUserRow,
  mapVirtualTableRow,
  type TableName,
  type TableRow,
} from "@/infrastructure/supabase/supabase-mappers";

export type SealRpgSupabaseClient = SupabaseClient<Database>;

interface ConflictDescriptor {
  field: string;
  message: string;
}

function throwDatabaseError(
  error: PostgrestError,
  conflict?: ConflictDescriptor,
): never {
  if (error.code === "23505" && conflict) {
    throw new RepositoryConflictError(conflict.field, conflict.message);
  }
  if (error.code === "23503") {
    throw new RepositoryConflictError(
      "relation",
      "Um dos registros relacionados não existe ou está em uso.",
    );
  }
  if (error.code === "23514" || error.code === "22023") {
    throw new RepositoryConflictError(
      "data",
      error.message || "Os dados informados são inválidos.",
    );
  }
  throw new Error(`Supabase (${error.code}): ${error.message}`);
}

function assertCharacterAttributes(attributes: Character["attributes"]): void {
  if (!isValidCharacterAttributes(attributes)) {
    throw new RepositoryConflictError(
      "attributes",
      "Distribua exatamente 8 pontos entre os atributos, usando de 0 a 5 em cada um.",
    );
  }
}

function assertClassBonuses(
  bonuses: CharacterClassOption["attributeBonuses"],
): void {
  if (!isValidCharacterAttributeBonuses(bonuses)) {
    throw new RepositoryConflictError(
      "attributeBonuses",
      "Os bônus da classe devem ser números inteiros entre 0 e 5.",
    );
  }
}

function asRecord(value: Json): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("O Supabase retornou um resultado inesperado.");
  }
  return value as Record<string, Json>;
}

function asTableRow<T extends TableName>(value: Json, key?: string): TableRow<T> {
  const record = asRecord(value);
  const selected = key ? record[key] : record;
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    throw new Error("O Supabase retornou um registro inesperado.");
  }
  return selected as unknown as TableRow<T>;
}

function setIfDefined(
  target: Record<string, unknown>,
  column: string,
  value: unknown,
): void {
  if (value !== undefined) target[column] = value;
}

abstract class SupabaseCrudRepository<
  T extends EntityBase,
  N extends TableName,
> implements CrudRepository<T>
{
  constructor(
    protected readonly client: SealRpgSupabaseClient,
    protected readonly table: N,
    private readonly mapRow: (row: TableRow<N>) => T,
    private readonly conflict?: ConflictDescriptor,
  ) {}

  protected abstract encodeCreate(input: CreateEntityInput<T>): Record<string, unknown>;

  protected abstract encodeUpdate(input: UpdateEntityInput<T>): Record<string, unknown>;

  async list(): Promise<T[]> {
    const { data, error } = await this.client.from(this.table).select("*");
    if (error) throwDatabaseError(error);
    return (data as unknown as TableRow<N>[]).map(this.mapRow);
  }

  async findById(id: EntityId): Promise<T | null> {
    // Supabase's generated generic table type cannot prove that every N used
    // by this CRUD base has an "id" column, although every concrete repository
    // that extends this class does. Keep the escape hatch isolated here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = this.client.from(this.table) as any;

    const { data, error } = await query
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throwDatabaseError(error);
    return data ? this.mapRow(data as unknown as TableRow<N>) : null;
  }

  async create(input: CreateEntityInput<T>): Promise<T> {
    const { data, error } = await this.client
      .from(this.table)
      .insert(this.encodeCreate(input) as never)
      .select("*")
      .single();

    if (error) throwDatabaseError(error, this.conflict);
    return this.mapRow(data as unknown as TableRow<N>);
  }

  async update(id: EntityId, input: UpdateEntityInput<T>): Promise<T | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = this.client.from(this.table) as any;

    const { data, error } = await query
      .update(this.encodeUpdate(input))
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throwDatabaseError(error, this.conflict);
    return data ? this.mapRow(data as unknown as TableRow<N>) : null;
  }

  async delete(id: EntityId): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = this.client.from(this.table) as any;

    const { data, error } = await query
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throwDatabaseError(error);
    return Boolean(data);
  }
}

function encodeCampaign(input: UpdateEntityInput<Campaign>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "slug", input.slug);
  setIfDefined(row, "short_description", input.shortDescription);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "setting", input.setting);
  setIfDefined(row, "genre", input.genre);
  setIfDefined(row, "status", input.status);
  setIfDefined(row, "cover_image_url", input.coverImageUrl);
  setIfDefined(row, "cover_image_storage_key", input.coverImageStorageKey);
  setIfDefined(row, "background_image_url", input.backgroundImageUrl);
  setIfDefined(row, "background_image_storage_key", input.backgroundImageStorageKey);
  setIfDefined(row, "primary_color", input.primaryColor);
  setIfDefined(row, "secondary_color", input.secondaryColor);
  setIfDefined(row, "start_date", input.startDate);
  setIfDefined(row, "game_master_user_id", input.gameMasterUserId);
  setIfDefined(row, "story_summary", input.storySummary);
  return row;
}

class SupabaseCampaignRepository
  extends SupabaseCrudRepository<Campaign, "campaigns">
  implements CampaignRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "campaigns", mapCampaignRow, {
      field: "slug",
      message: "Já existe uma campanha com este slug.",
    });
  }

  protected encodeCreate(input: CreateEntityInput<Campaign>) {
    return encodeCampaign(input);
  }

  protected encodeUpdate(input: UpdateEntityInput<Campaign>) {
    return encodeCampaign(input);
  }

  async findBySlug(slug: string): Promise<Campaign | null> {
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .ilike("slug", slug.trim())
      .maybeSingle();
    if (error) throwDatabaseError(error);
    return data ? mapCampaignRow(data) : null;
  }

  async listForUser(userId: EntityId): Promise<Campaign[]> {
    const { data: memberships, error: membershipError } = await this.client
      .from("campaign_members")
      .select("campaign_id")
      .eq("user_id", userId)
      .eq("status", "approved");
    if (membershipError) throwDatabaseError(membershipError);
    const campaignIds = memberships.map((membership) => membership.campaign_id);
    if (!campaignIds.length) return [];
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .in("id", campaignIds);
    if (error) throwDatabaseError(error);
    return data.map(mapCampaignRow);
  }

  override async delete(id: EntityId): Promise<boolean> {
    return (await this.deleteWithStorageKeys(id)).deleted;
  }

  async deleteWithStorageKeys(
    id: EntityId,
  ): Promise<{ deleted: boolean; storageKeys: string[] }> {
    const [campaign, chapters, characters, classes, files] = await Promise.all([
      this.findById(id),
      this.client
        .from("campaign_chapters")
        .select("background_image_storage_key")
        .eq("campaign_id", id),
      this.client
        .from("characters")
        .select("cover_image_storage_key, background_image_storage_key")
        .eq("campaign_id", id),
      this.client
        .from("character_class_options")
        .select("logo_image_storage_key")
        .eq("campaign_id", id),
      this.client.from("game_files").select("storage_key").eq("campaign_id", id),
    ]);
    for (const result of [chapters, characters, classes, files]) {
      if (result.error) throwDatabaseError(result.error);
    }
    if (!campaign) return { deleted: false, storageKeys: [] };

    const storageKeys = [
      campaign.coverImageStorageKey,
      campaign.backgroundImageStorageKey,
      ...(chapters.data ?? []).map((row) => row.background_image_storage_key),
      ...(characters.data ?? []).flatMap((row) => [
        row.cover_image_storage_key,
        row.background_image_storage_key,
      ]),
      ...(classes.data ?? []).map((row) => row.logo_image_storage_key),
      ...(files.data ?? []).map((row) => row.storage_key),
    ].filter((value): value is string => Boolean(value));

    return { deleted: await super.delete(id), storageKeys: [...new Set(storageKeys)] };
  }
}

function encodeMembership(
  input: UpdateEntityInput<CampaignMember>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "user_id", input.userId);
  setIfDefined(row, "role", input.role);
  setIfDefined(row, "status", input.status);
  setIfDefined(row, "joined_at", input.joinedAt);
  return row;
}

class SupabaseCampaignMemberRepository
  extends SupabaseCrudRepository<CampaignMember, "campaign_members">
  implements CampaignMemberRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "campaign_members", mapCampaignMemberRow, {
      field: "membership",
      message: "Este usuário já possui um vínculo com a campanha.",
    });
  }
  protected encodeCreate(input: CreateEntityInput<CampaignMember>) {
    return encodeMembership(input);
  }
  protected encodeUpdate(input: UpdateEntityInput<CampaignMember>) {
    return encodeMembership(input);
  }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId);
    if (error) throwDatabaseError(error);
    return data.map(mapCampaignMemberRow);
  }
  async listByUser(userId: EntityId) {
    const { data, error } = await this.client
      .from("campaign_members")
      .select("*")
      .eq("user_id", userId);
    if (error) throwDatabaseError(error);
    return data.map(mapCampaignMemberRow);
  }
  async requestAccess(campaignId: EntityId, userId: EntityId) {
    const { data, error } = await this.client.rpc(
      "request_campaign_membership",
      { target_campaign_id: campaignId },
    );
    if (error) throwDatabaseError(error);
    if (!data || data.user_id !== userId) {
      throw new Error("O Supabase não confirmou a solicitação de acesso.");
    }
    return mapCampaignMemberRow(data);
  }
  async findMembership(campaignId: EntityId, userId: EntityId) {
    const { data, error } = await this.client
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throwDatabaseError(error);
    return data ? mapCampaignMemberRow(data) : null;
  }
}

function encodeChapter(
  input: UpdateEntityInput<CampaignChapter>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "title", input.title);
  setIfDefined(row, "slug", input.slug);
  setIfDefined(row, "short_description", input.shortDescription);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "background_image_url", input.backgroundImageUrl);
  setIfDefined(row, "background_image_storage_key", input.backgroundImageStorageKey);
  setIfDefined(row, "sort_order", input.order);
  setIfDefined(row, "status", input.status);
  return row;
}

class SupabaseCampaignChapterRepository
  extends SupabaseCrudRepository<CampaignChapter, "campaign_chapters">
  implements CampaignChapterRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "campaign_chapters", mapCampaignChapterRow, {
      field: "slug",
      message: "Já existe um capítulo com este slug nesta campanha.",
    });
  }
  protected encodeCreate(input: CreateEntityInput<CampaignChapter>) {
    return { ...encodeChapter(input), completed_at: null };
  }
  protected encodeUpdate(input: UpdateEntityInput<CampaignChapter>) {
    return encodeChapter(input);
  }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client
      .from("campaign_chapters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sort_order")
      .order("title");
    if (error) throwDatabaseError(error);
    return data.map(mapCampaignChapterRow);
  }
  async findBySlug(campaignId: EntityId, slug: string) {
    const { data, error } = await this.client
      .from("campaign_chapters")
      .select("*")
      .eq("campaign_id", campaignId)
      .ilike("slug", slug.trim())
      .maybeSingle();
    if (error) throwDatabaseError(error);
    return data ? mapCampaignChapterRow(data) : null;
  }
}

function encodeStatusOption(
  input: UpdateEntityInput<CharacterStatusOption>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "slug", input.slug);
  setIfDefined(row, "color", input.color);
  setIfDefined(row, "sort_order", input.order);
  setIfDefined(row, "active", input.active);
  return row;
}

class SupabaseCharacterStatusOptionRepository
  extends SupabaseCrudRepository<CharacterStatusOption, "character_status_options">
  implements CharacterStatusOptionRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "character_status_options", mapCharacterStatusOptionRow, {
      field: "slug",
      message: "Já existe uma opção com este slug nesta campanha.",
    });
  }
  protected encodeCreate(input: CreateEntityInput<CharacterStatusOption>) {
    return encodeStatusOption(input);
  }
  protected encodeUpdate(input: UpdateEntityInput<CharacterStatusOption>) {
    return encodeStatusOption(input);
  }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client
      .from("character_status_options")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sort_order")
      .order("name");
    if (error) throwDatabaseError(error);
    return data.map(mapCharacterStatusOptionRow);
  }
  override async delete(id: EntityId): Promise<boolean> {
    const { count, error } = await this.client
      .from("characters")
      .select("id", { count: "exact", head: true })
      .eq("status_option_id", id);
    if (error) throwDatabaseError(error);
    if (count) {
      throw new RepositoryConflictError("option", "Esta opção está sendo usada por uma ficha.");
    }
    return super.delete(id);
  }
}

function encodeClassOption(
  input: UpdateEntityInput<CharacterClassOption>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "slug", input.slug);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "logo_image_url", input.logoImageUrl);
  setIfDefined(row, "logo_image_storage_key", input.logoImageStorageKey);
  setIfDefined(row, "sort_order", input.order);
  setIfDefined(row, "active", input.active);
  if (input.attributeBonuses !== undefined) {
    setIfDefined(row, "bonus_physical", input.attributeBonuses.physical);
    setIfDefined(row, "bonus_agility", input.attributeBonuses.agility);
    setIfDefined(row, "bonus_marksmanship", input.attributeBonuses.marksmanship);
    setIfDefined(row, "bonus_perception", input.attributeBonuses.perception);
    setIfDefined(row, "bonus_technique", input.attributeBonuses.technique);
    setIfDefined(row, "bonus_control", input.attributeBonuses.control);
  }
  return row;
}

class SupabaseCharacterClassOptionRepository
  extends SupabaseCrudRepository<CharacterClassOption, "character_class_options">
  implements CharacterClassOptionRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "character_class_options", mapCharacterClassOptionRow, {
      field: "slug",
      message: "Já existe uma opção com este slug nesta campanha.",
    });
  }
  protected encodeCreate(input: CreateEntityInput<CharacterClassOption>) {
    assertClassBonuses(input.attributeBonuses);
    return encodeClassOption(input);
  }
  protected encodeUpdate(input: UpdateEntityInput<CharacterClassOption>) {
    if (input.attributeBonuses) assertClassBonuses(input.attributeBonuses);
    return encodeClassOption(input);
  }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client
      .from("character_class_options")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sort_order")
      .order("name");
    if (error) throwDatabaseError(error);
    return data.map(mapCharacterClassOptionRow);
  }
  override async delete(id: EntityId): Promise<boolean> {
    const { count, error } = await this.client
      .from("characters")
      .select("id", { count: "exact", head: true })
      .eq("class_option_id", id);
    if (error) throwDatabaseError(error);
    if (count) {
      throw new RepositoryConflictError("option", "Esta opção está sendo usada por uma ficha.");
    }
    return super.delete(id);
  }
}

function encodeCharacter(input: UpdateEntityInput<Character>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "user_id", input.userId);
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "slug", input.slug);
  setIfDefined(row, "short_description", input.shortDescription);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "gender", input.gender);
  setIfDefined(row, "status_option_id", input.statusOptionId);
  setIfDefined(row, "class_option_id", input.classOptionId);
  if (input.attributes !== undefined) {
    setIfDefined(row, "attribute_physical", input.attributes.physical);
    setIfDefined(row, "attribute_agility", input.attributes.agility);
    setIfDefined(row, "attribute_marksmanship", input.attributes.marksmanship);
    setIfDefined(row, "attribute_perception", input.attributes.perception);
    setIfDefined(row, "attribute_technique", input.attributes.technique);
    setIfDefined(row, "attribute_control", input.attributes.control);
  }
  setIfDefined(row, "cover_image_url", input.coverImageUrl);
  setIfDefined(row, "cover_image_storage_key", input.coverImageStorageKey);
  setIfDefined(row, "background_image_url", input.backgroundImageUrl);
  setIfDefined(row, "background_image_storage_key", input.backgroundImageStorageKey);
  setIfDefined(row, "primary_color", input.primaryColor);
  setIfDefined(row, "secondary_color", input.secondaryColor);
  setIfDefined(row, "start_date", input.startDate);
  setIfDefined(row, "equipment", input.equipment);
  setIfDefined(row, "wounds", input.wounds);
  setIfDefined(row, "backpack_items", input.backpackItems);
  setIfDefined(row, "inventory_slots", input.inventorySlots);
  return row;
}

const LOADOUT_KEYS = new Set(["equipment", "wounds", "backpackItems", "inventorySlots"]);

class SupabaseCharacterRepository
  extends SupabaseCrudRepository<Character, "characters">
  implements CharacterRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "characters", mapCharacterRow, {
      field: "slug",
      message: "Já existe uma ficha com este slug nesta campanha.",
    });
  }
  protected encodeCreate(input: CreateEntityInput<Character>) {
    assertCharacterAttributes(input.attributes);
    return encodeCharacter({
      ...input,
      equipment: input.equipment ?? [],
      wounds: input.wounds ?? [],
      backpackItems: input.backpackItems ?? [],
      inventorySlots: input.inventorySlots ?? 8,
    });
  }
  protected encodeUpdate(input: UpdateEntityInput<Character>) {
    if (input.attributes) assertCharacterAttributes(input.attributes);
    return encodeCharacter(input);
  }
  override async update(id: EntityId, input: UpdateEntityInput<Character>) {
    const keys = Object.keys(input);
    if (keys.length > 0 && keys.every((key) => LOADOUT_KEYS.has(key))) {
      const current = await this.findById(id);
      if (!current) return null;
      const { data, error } = await this.client.rpc("update_character_loadout", {
        target_character_id: id,
        new_equipment: input.equipment ?? current.equipment,
        new_wounds: input.wounds ?? current.wounds,
        new_backpack_items: input.backpackItems ?? current.backpackItems,
        new_inventory_slots: input.inventorySlots ?? current.inventorySlots,
      });
      if (error) throwDatabaseError(error);
      return mapCharacterRow(data);
    }
    return super.update(id, input);
  }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name");
    if (error) throwDatabaseError(error);
    return data.map(mapCharacterRow);
  }
  async findBySlug(campaignId: EntityId, slug: string) {
    const { data, error } = await this.client
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .ilike("slug", slug.trim())
      .maybeSingle();
    if (error) throwDatabaseError(error);
    return data ? mapCharacterRow(data) : null;
  }
  override async delete(id: EntityId): Promise<boolean> {
    return (await this.deleteWithTableFiles(id)).deleted;
  }
  async deleteWithTableFiles(id: EntityId) {
    const character = await this.findById(id);
    if (!character) return { deleted: false, fileIds: [] };
    const { data: tokens, error } = await this.client
      .from("virtual_table_tokens")
      .select("image_file_id")
      .eq("character_id", id);
    if (error) throwDatabaseError(error);
    const fileIds = tokens
      .map((token) => token.image_file_id)
      .filter((value): value is string => Boolean(value));
    return { deleted: await super.delete(id), fileIds: [...new Set(fileIds)] };
  }
}

function encodeTeam(input: UpdateEntityInput<Team>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "image_url", input.imageUrl);
  setIfDefined(row, "sort_order", input.order);
  return row;
}

class SupabaseTeamRepository
  extends SupabaseCrudRepository<Team, "teams">
  implements TeamRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "teams", mapTeamRow);
  }
  protected encodeCreate(input: CreateEntityInput<Team>) { return encodeTeam(input); }
  protected encodeUpdate(input: UpdateEntityInput<Team>) { return encodeTeam(input); }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client.from("teams").select("*").eq("campaign_id", campaignId).order("sort_order");
    if (error) throwDatabaseError(error);
    return data.map(mapTeamRow);
  }
}

class SupabaseTeamMemberRepository
  extends SupabaseCrudRepository<TeamMember, "team_members">
  implements TeamMemberRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "team_members", mapTeamMemberRow); }
  protected encodeCreate(input: CreateEntityInput<TeamMember>) {
    return { team_id: input.teamId, character_id: input.characterId, sort_order: input.order };
  }
  protected encodeUpdate(input: UpdateEntityInput<TeamMember>) {
    const row: Record<string, unknown> = {};
    setIfDefined(row, "team_id", input.teamId);
    setIfDefined(row, "character_id", input.characterId);
    setIfDefined(row, "sort_order", input.order);
    return row;
  }
  async listByTeam(teamId: EntityId) {
    const { data, error } = await this.client.from("team_members").select("*").eq("team_id", teamId).order("sort_order");
    if (error) throwDatabaseError(error);
    return data.map(mapTeamMemberRow);
  }
}

function encodeMission(input: UpdateEntityInput<Mission>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "mission_number", input.missionNumber);
  setIfDefined(row, "image_url", input.imageUrl);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "briefing", input.briefing);
  setIfDefined(row, "primary_objective", input.primaryObjective);
  setIfDefined(row, "secondary_objectives", input.secondaryObjectives);
  setIfDefined(row, "status", input.status);
  setIfDefined(row, "scheduled_at", input.scheduledAt);
  setIfDefined(row, "result", input.result);
  setIfDefined(row, "notes", input.notes);
  setIfDefined(row, "sort_order", input.order);
  return row;
}

class SupabaseMissionRepository
  extends SupabaseCrudRepository<Mission, "missions">
  implements MissionRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "missions", mapMissionRow); }
  protected encodeCreate(input: CreateEntityInput<Mission>) { return encodeMission(input); }
  protected encodeUpdate(input: UpdateEntityInput<Mission>) { return encodeMission(input); }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client.from("missions").select("*").eq("campaign_id", campaignId).order("sort_order");
    if (error) throwDatabaseError(error);
    return data.map(mapMissionRow);
  }
}

class SupabaseMissionParticipantRepository
  extends SupabaseCrudRepository<MissionParticipant, "mission_participants">
  implements MissionParticipantRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "mission_participants", mapMissionParticipantRow); }
  protected encodeCreate(input: CreateEntityInput<MissionParticipant>) {
    return { mission_id: input.missionId, character_id: input.characterId };
  }
  protected encodeUpdate(input: UpdateEntityInput<MissionParticipant>) {
    const row: Record<string, unknown> = {};
    setIfDefined(row, "mission_id", input.missionId);
    setIfDefined(row, "character_id", input.characterId);
    return row;
  }
  async listByMission(missionId: EntityId) {
    const { data, error } = await this.client.from("mission_participants").select("*").eq("mission_id", missionId);
    if (error) throwDatabaseError(error);
    return data.map(mapMissionParticipantRow);
  }
}

function encodeSession(input: UpdateEntityInput<CampaignSession>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "session_number", input.sessionNumber);
  setIfDefined(row, "title", input.title);
  setIfDefined(row, "status", input.status);
  setIfDefined(row, "scheduled_at", input.scheduledAt);
  setIfDefined(row, "occurred_at", input.occurredAt);
  setIfDefined(row, "summary", input.summary);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "events", input.events);
  setIfDefined(row, "consequences", input.consequences);
  return row;
}

class SupabaseCampaignSessionRepository
  extends SupabaseCrudRepository<CampaignSession, "campaign_sessions">
  implements CampaignSessionRepository
{
  constructor(client: SealRpgSupabaseClient) {
    super(client, "campaign_sessions", mapCampaignSessionRow, {
      field: "sessionNumber",
      message: "Já existe uma sessão com este número nesta campanha.",
    });
  }
  protected encodeCreate(input: CreateEntityInput<CampaignSession>) { return encodeSession(input); }
  protected encodeUpdate(input: UpdateEntityInput<CampaignSession>) { return encodeSession(input); }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client.from("campaign_sessions").select("*").eq("campaign_id", campaignId).order("session_number", { ascending: false });
    if (error) throwDatabaseError(error);
    return data.map(mapCampaignSessionRow);
  }
  async updateAndCloseTable(id: EntityId, input: UpdateEntityInput<CampaignSession>) {
    const current = await this.findById(id);
    if (!current) return null;
    const merged = { ...current, ...input };
    if (merged.status === "scheduled") return { session: (await this.update(id, input))!, table: null };
    const { data, error } = await this.client.rpc(
      "admin_update_campaign_session_and_close_table",
      {
        target_session_id: id,
        target_campaign_id: merged.campaignId,
        new_session_number: merged.sessionNumber,
        new_title: merged.title,
        new_status: merged.status,
        new_scheduled_at: merged.scheduledAt,
        new_occurred_at: merged.occurredAt,
        new_summary: merged.summary,
        new_description: merged.description,
        new_events: merged.events,
        new_consequences: merged.consequences,
      } as never,
    );
    if (error) throwDatabaseError(error, {
      field: "sessionNumber",
      message: "Já existe uma sessão com este número nesta campanha.",
    });
    const result = asRecord(data);
    const tableJson = result.table;
    return {
      session: mapCampaignSessionRow(asTableRow<"campaign_sessions">(data, "session")),
      table:
        tableJson && typeof tableJson === "object" && !Array.isArray(tableJson)
          ? mapVirtualTableRow(tableJson as unknown as TableRow<"virtual_tables">)
          : null,
    };
  }
  async completeTableSession(tableId: EntityId, _occurredAt: string) {
    const { data, error } = await this.client.rpc("close_virtual_table", {
      target_table_id: tableId,
    });
    if (error) {
      if (error.code === "P0002") return null;
      throwDatabaseError(error);
    }
    return {
      session: mapCampaignSessionRow(asTableRow<"campaign_sessions">(data, "session")),
      table: mapVirtualTableRow(asTableRow<"virtual_tables">(data, "table")),
    };
  }
  override async delete(id: EntityId): Promise<boolean> {
    return (await this.deleteWithTableFiles(id)).deleted;
  }
  async deleteWithTableFiles(id: EntityId) {
    const session = await this.findById(id);
    if (!session) return { deleted: false, fileIds: [] };
    const { data: tables, error: tableError } = await this.client
      .from("virtual_tables")
      .select("id, map_file_id")
      .eq("session_id", id);
    if (tableError) throwDatabaseError(tableError);
    const tableIds = tables.map((table) => table.id);
    let tokenFileIds: string[] = [];
    if (tableIds.length) {
      const { data: tokens, error: tokenError } = await this.client
        .from("virtual_table_tokens")
        .select("image_file_id")
        .in("table_id", tableIds);
      if (tokenError) throwDatabaseError(tokenError);
      tokenFileIds = tokens.map((token) => token.image_file_id).filter((value): value is string => Boolean(value));
    }
    const fileIds = [
      ...tables.map((table) => table.map_file_id),
      ...tokenFileIds,
    ].filter((value): value is string => Boolean(value));
    return { deleted: await super.delete(id), fileIds: [...new Set(fileIds)] };
  }
}

class SupabaseSessionParticipantRepository
  extends SupabaseCrudRepository<SessionParticipant, "session_participants">
  implements SessionParticipantRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "session_participants", mapSessionParticipantRow); }
  protected encodeCreate(input: CreateEntityInput<SessionParticipant>) { return { session_id: input.sessionId, character_id: input.characterId }; }
  protected encodeUpdate(input: UpdateEntityInput<SessionParticipant>) {
    const row: Record<string, unknown> = {};
    setIfDefined(row, "session_id", input.sessionId);
    setIfDefined(row, "character_id", input.characterId);
    return row;
  }
  async listBySession(sessionId: EntityId) {
    const { data, error } = await this.client.from("session_participants").select("*").eq("session_id", sessionId);
    if (error) throwDatabaseError(error);
    return data.map(mapSessionParticipantRow);
  }
}

function encodeEvent(input: UpdateEntityInput<CampaignEvent>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "title", input.title);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "occurred_at", input.occurredAt);
  setIfDefined(row, "type", input.type);
  setIfDefined(row, "image_url", input.imageUrl);
  setIfDefined(row, "sort_order", input.order);
  return row;
}

class SupabaseCampaignEventRepository
  extends SupabaseCrudRepository<CampaignEvent, "campaign_events">
  implements CampaignEventRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "campaign_events", mapCampaignEventRow); }
  protected encodeCreate(input: CreateEntityInput<CampaignEvent>) { return encodeEvent(input); }
  protected encodeUpdate(input: UpdateEntityInput<CampaignEvent>) { return encodeEvent(input); }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client.from("campaign_events").select("*").eq("campaign_id", campaignId).order("sort_order");
    if (error) throwDatabaseError(error);
    return data.map(mapCampaignEventRow);
  }
}

function encodeFile(input: UpdateEntityInput<GameFile>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  setIfDefined(row, "campaign_id", input.campaignId);
  setIfDefined(row, "name", input.name);
  setIfDefined(row, "description", input.description);
  setIfDefined(row, "category", input.category);
  setIfDefined(row, "visibility", input.visibility);
  setIfDefined(row, "storage_key", input.storageKey);
  setIfDefined(row, "mime_type", input.mimeType);
  setIfDefined(row, "size_bytes", input.sizeBytes);
  return row;
}

class SupabaseFileRepository
  extends SupabaseCrudRepository<GameFile, "game_files">
  implements FileRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "game_files", mapGameFileRow, { field: "storageKey", message: "Este arquivo já está cadastrado." }); }
  protected encodeCreate(input: CreateEntityInput<GameFile>) {
    return {
      ...encodeFile(input),
      created_by_user_id: input.createdByUserId,
    };
  }
  protected encodeUpdate(input: UpdateEntityInput<GameFile>) { return encodeFile(input); }
  async listByCampaign(campaignId: EntityId) {
    const { data, error } = await this.client.from("game_files").select("*").eq("campaign_id", campaignId).order("updated_at", { ascending: false });
    if (error) throwDatabaseError(error);
    return data.map(mapGameFileRow);
  }
}

class SupabaseFileRelationRepository
  extends SupabaseCrudRepository<FileRelation, "file_relations">
  implements FileRelationRepository
{
  constructor(client: SealRpgSupabaseClient) { super(client, "file_relations", mapFileRelationRow, { field: "relation", message: "Este arquivo já está vinculado ao registro." }); }
  protected encodeCreate(input: CreateEntityInput<FileRelation>) { return { file_id: input.fileId, relation_type: input.relationType, relation_id: input.relationId }; }
  protected encodeUpdate(input: UpdateEntityInput<FileRelation>) {
    const row: Record<string, unknown> = {};
    setIfDefined(row, "file_id", input.fileId);
    setIfDefined(row, "relation_type", input.relationType);
    setIfDefined(row, "relation_id", input.relationId);
    return row;
  }
  async listByFile(fileId: EntityId) {
    const { data, error } = await this.client.from("file_relations").select("*").eq("file_id", fileId);
    if (error) throwDatabaseError(error);
    return data.map(mapFileRelationRow);
  }
}

class SupabaseUserRepository implements UserRepository {
  constructor(private readonly client: SealRpgSupabaseClient) {}

  async list(): Promise<User[]> {
    const { data, error } = await this.client.rpc("admin_list_profiles");
    if (!error) return data.map(mapUserRow);
    if (error.code !== "42501") throwDatabaseError(error);
    const fallback = await this.client
      .from("profiles")
      .select("id, name, username, avatar_url, role, status, created_at, updated_at");
    if (fallback.error) throwDatabaseError(fallback.error);
    return fallback.data.map(mapUserRow);
  }

  async findById(id: EntityId): Promise<User | null> {
    return (await this.list()).find((user) => user.id === id) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const normalized = username.trim().toLocaleLowerCase("pt-BR");
    return (await this.list()).find((user) => user.username.toLocaleLowerCase("pt-BR") === normalized) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLocaleLowerCase("pt-BR");
    return (await this.list()).find((user) => user.email.toLocaleLowerCase("pt-BR") === normalized) ?? null;
  }

  async create(_input: CreateEntityInput<User>): Promise<User> {
    throw new RepositoryConflictError("user", "Usuários devem ser criados pelo Supabase Auth.");
  }

  async update(id: EntityId, input: UpdateEntityInput<User>): Promise<User | null> {
    const current = await this.findById(id);
    if (!current) return null;
    let updated = current;
    if (input.role !== undefined || input.status !== undefined) {
      const { data, error } = await this.client.rpc("admin_update_profile_access", {
        target_profile_id: id,
        target_role: input.role ?? current.role,
        target_status: input.status ?? current.status,
      });
      if (error) throwDatabaseError(error);
      updated = mapUserRow(data);
    }
    const profileChanges: Database["public"]["Tables"]["profiles"]["Update"] = {};
    setIfDefined(profileChanges, "name", input.name);
    setIfDefined(profileChanges, "username", input.username);
    setIfDefined(profileChanges, "avatar_url", input.avatarUrl);
    if (Object.keys(profileChanges).length) {
      const { data, error } = await this.client
        .from("profiles")
        .update(profileChanges)
        .eq("id", id)
        .select("id, name, username, avatar_url, role, status, created_at, updated_at")
        .maybeSingle();
      if (error) throwDatabaseError(error, { field: "username", message: "Este nome de usuário já está em uso." });
      if (data) updated = mapUserRow({ ...data, email: updated.email });
    }
    return updated;
  }

  async delete(_id: EntityId): Promise<boolean> {
    throw new RepositoryConflictError("user", "Usuários devem ser removidos pelo Supabase Auth.");
  }
}

class SupabaseDashboardSummaryRepository implements DashboardSummaryRepository {
  constructor(private readonly client: SealRpgSupabaseClient) {}
  async getContentCounts() {
    const [users, campaigns, characters, teams, missions, sessions, events, files] = await Promise.all([
      this.client.rpc("admin_list_profiles"),
      this.client.from("campaigns").select("id", { count: "exact", head: true }),
      this.client.from("characters").select("id", { count: "exact", head: true }),
      this.client.from("teams").select("id", { count: "exact", head: true }),
      this.client.from("missions").select("id", { count: "exact", head: true }),
      this.client.from("campaign_sessions").select("id", { count: "exact", head: true }),
      this.client.from("campaign_events").select("id", { count: "exact", head: true }),
      this.client.from("game_files").select("id", { count: "exact", head: true }),
    ]);
    if (users.error) throwDatabaseError(users.error);
    for (const result of [campaigns, characters, teams, missions, sessions, events, files]) {
      if (result.error) throwDatabaseError(result.error);
    }
    return {
      campaigns: campaigns.count ?? 0,
      users: users.data.length,
      characters: characters.count ?? 0,
      teams: teams.count ?? 0,
      missions: missions.count ?? 0,
      sessions: sessions.count ?? 0,
      events: events.count ?? 0,
      files: files.count ?? 0,
    };
  }
}

export type SupabaseDataRepositories = Omit<RepositoryRegistry, "tabletop">;

export function createSupabaseDataRepositories(
  client: SealRpgSupabaseClient,
): SupabaseDataRepositories {
  return {
    users: new SupabaseUserRepository(client),
    campaigns: new SupabaseCampaignRepository(client),
    campaignChapters: new SupabaseCampaignChapterRepository(client),
    campaignMembers: new SupabaseCampaignMemberRepository(client),
    characters: new SupabaseCharacterRepository(client),
    characterStatusOptions: new SupabaseCharacterStatusOptionRepository(client),
    characterClassOptions: new SupabaseCharacterClassOptionRepository(client),
    teams: new SupabaseTeamRepository(client),
    teamMembers: new SupabaseTeamMemberRepository(client),
    missions: new SupabaseMissionRepository(client),
    missionParticipants: new SupabaseMissionParticipantRepository(client),
    campaignSessions: new SupabaseCampaignSessionRepository(client),
    sessionParticipants: new SupabaseSessionParticipantRepository(client),
    campaignEvents: new SupabaseCampaignEventRepository(client),
    files: new SupabaseFileRepository(client),
    fileRelations: new SupabaseFileRelationRepository(client),
    dashboardSummary: new SupabaseDashboardSummaryRepository(client),
  };
}

export function createSupabaseRepositories(
  client: SealRpgSupabaseClient,
  tabletop: TabletopRepository,
): RepositoryRegistry {
  return { ...createSupabaseDataRepositories(client), tabletop };
}
