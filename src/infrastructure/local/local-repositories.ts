import "server-only";

import { randomUUID } from "node:crypto";

import type {
  Campaign,
  CampaignChapter,
  CampaignEvent,
  CampaignMember,
  CampaignSession,
  Character,
  CharacterClassOption,
  CharacterStatusOption,
  DiceRoll,
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
  VirtualTableMap,
  VirtualTableToken,
} from "@/domain/entities";
import {
  getCharacterAttributeBudget,
  isValidCharacterAttributeBonuses,
  isValidCharacterAttributesForCampaign,
} from "@/domain/character-attributes";
import {
  compareCampaignChapters,
  resolveCampaignChapterProgression,
} from "@/domain/chapter-progression";
import { canManageCampaign } from "@/domain/permissions";
import type {
  AdvanceVirtualTableChapterInput,
  CampaignEventRepository,
  CampaignChapterRepository,
  CampaignMemberRepository,
  CampaignRepository,
  CampaignSessionRepository,
  CharacterRepository,
  CharacterClassOptionRepository,
  CharacterStatusOptionRepository,
  CreateEntityInput,
  CrudRepository,
  DashboardSummaryRepository,
  FileRelationRepository,
  FileRepository,
  MissionParticipantRepository,
  MissionRepository,
  OpenVirtualTableInput,
  RollbackVirtualTableChapterInput,
  RepositoryRegistry,
  SessionParticipantRepository,
  TeamMemberRepository,
  TeamRepository,
  TabletopRepository,
  UpdateEntityInput,
  UserRepository,
} from "@/domain/repositories";
import { RepositoryConflictError } from "@/domain/repositories";
import type {
  DomainTableName,
  LocalDatabase,
} from "@/infrastructure/local/local-database.types";
import { JsonDatabase } from "@/infrastructure/local/json-database";

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

interface ChapterProgressionCheckpoint {
  currentChapterId: EntityId | null;
  completedChapterIds: EntityId[];
  initialized: boolean;
}

function chapterProgressionCheckpoint(
  database: LocalDatabase,
  campaignId: EntityId,
): ChapterProgressionCheckpoint {
  const progression = resolveCampaignChapterProgression(
    database.campaignChapters.filter(
      (chapter) => chapter.campaignId === campaignId,
    ),
  );

  return {
    currentChapterId: progression.currentChapter?.id ?? null,
    completedChapterIds: progression.entries
      .filter((entry) => entry.state === "completed")
      .map((entry) => entry.chapter.id),
    initialized:
      progression.entries.length > 0 || progression.completedCount > 0,
  };
}

function assertOpenTableProgressionPreserved(
  database: LocalDatabase,
  campaignId: EntityId,
  before: ChapterProgressionCheckpoint,
): void {
  const hasOpenTable = database.virtualTables.some(
    (table) => table.campaignId === campaignId && table.status === "open",
  );
  if (!hasOpenTable || !before.initialized) return;

  const after = chapterProgressionCheckpoint(database, campaignId);
  const completedChaptersPreserved =
    before.completedChapterIds.length === after.completedChapterIds.length &&
    before.completedChapterIds.every(
      (chapterId, index) => after.completedChapterIds[index] === chapterId,
    );

  if (
    before.currentChapterId !== after.currentChapterId ||
    !completedChaptersPreserved
  ) {
    throw new RepositoryConflictError(
      "progression",
      "A mesa está aberta. Conclua o capítulo atual pela mesa antes de alterar uma etapa já alcançada.",
    );
  }
}

type VirtualTableRevisionInput = Partial<
  Pick<
    VirtualTable,
    | "status"
    | "mapFileId"
    | "activeMapId"
    | "lastChapterTransition"
    | "openedByUserId"
    | "openedAt"
    | "closedAt"
  >
>;

function reviseVirtualTable(
  database: LocalDatabase,
  index: number,
  input: VirtualTableRevisionInput = {},
): VirtualTable {
  const current = database.virtualTables[index];
  const updated: VirtualTable = {
    ...current,
    ...input,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
    revision: current.revision + 1,
  };
  database.virtualTables[index] = updated;
  return updated;
}

function assertNormalizedCoordinate(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("A posição do token deve estar entre 0 e 1.");
  }
}

function assertHexColor(value: string, field: string): void {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new RepositoryConflictError(field, "A cor informada é inválida.");
  }
}

function assertCharacterAttributes(value: unknown, campaignSlug: string): void {
  const budget = getCharacterAttributeBudget(campaignSlug);
  if (!isValidCharacterAttributesForCampaign(value, campaignSlug)) {
    throw new RepositoryConflictError(
      "attributes",
      `Distribua exatamente ${budget} pontos entre os atributos desta campanha.`,
    );
  }
}

function assertCharacterAttributeBonuses(value: unknown): void {
  if (!isValidCharacterAttributeBonuses(value)) {
    throw new RepositoryConflictError(
      "attributeBonuses",
      "Os bônus da classe devem ser números inteiros entre 0 e 5.",
    );
  }
}

function assertTokenCustomization(
  input: Partial<VirtualTableToken>,
): void {
  if (input.size !== undefined && (!Number.isFinite(input.size) || input.size < 0.01 || input.size > 0.12)) {
    throw new RepositoryConflictError(
      "size",
      "O tamanho do token deve estar entre 0,01 e 0,12.",
    );
  }
  if (
    input.rotation !== undefined &&
    (!Number.isFinite(input.rotation) || input.rotation < 0 || input.rotation >= 360)
  ) {
    throw new RepositoryConflictError("rotation", "A rotação deve estar entre 0 e 359 graus.");
  }
  if (
    input.visionAngle !== undefined &&
    (!Number.isFinite(input.visionAngle) || input.visionAngle < 10 || input.visionAngle > 180)
  ) {
    throw new RepositoryConflictError("visionAngle", "O cone de visão deve ter entre 10° e 180°.");
  }
  if (
    input.visionRange !== undefined &&
    (!Number.isFinite(input.visionRange) || input.visionRange < 0.05 || input.visionRange > 0.6)
  ) {
    throw new RepositoryConflictError("visionRange", "O alcance da visão deve estar entre 0,05 e 0,6.");
  }
  if (input.accentColor !== undefined) assertHexColor(input.accentColor, "accentColor");
  if (input.visionColor !== undefined) assertHexColor(input.visionColor, "visionColor");
}

function updateCampaignSessionRecord(
  database: LocalDatabase,
  id: EntityId,
  input: UpdateEntityInput<CampaignSession>,
): CampaignSession | null {
  const index = database.campaignSessions.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const current = database.campaignSessions[index];
  const campaignId = input.campaignId ?? current.campaignId;
  const sessionNumber = input.sessionNumber ?? current.sessionNumber;
  if (
    database.campaignSessions.some(
      (item) =>
        item.id !== id &&
        item.campaignId === campaignId &&
        item.sessionNumber === sessionNumber,
    )
  ) {
    throw new RepositoryConflictError(
      "sessionNumber",
      "Já existe uma sessão com este número nesta campanha.",
    );
  }
  const updated: CampaignSession = {
    ...current,
    ...input,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  database.campaignSessions[index] = updated;
  return updated;
}

class LocalCrudRepository<T extends EntityBase>
  implements CrudRepository<T>
{
  constructor(
    protected readonly database: JsonDatabase,
    private readonly table: DomainTableName,
  ) {}

  async list(): Promise<T[]> {
    const database = await this.database.read();
    // The table/entity pairing is fixed by each concrete repository constructor.
    return structuredClone(database[this.table] as unknown as T[]);
  }

  async findById(id: EntityId): Promise<T | null> {
    const rows = await this.list();
    return rows.find((row) => row.id === id) ?? null;
  }

  async create(input: CreateEntityInput<T>): Promise<T> {
    return this.database.mutate((database) => {
      const now = new Date().toISOString();
      const entity = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as unknown as T;
      const rows = database[this.table] as unknown as T[];
      rows.push(entity);
      return structuredClone(entity);
    });
  }

  async update(
    id: EntityId,
    input: UpdateEntityInput<T>,
  ): Promise<T | null> {
    return this.database.mutate((database) => {
      const rows = database[this.table] as unknown as T[];
      const index = rows.findIndex((row) => row.id === id);

      if (index === -1) {
        return null;
      }

      const current = rows[index];
      const updated = {
        ...current,
        ...input,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      } as unknown as T;
      rows[index] = updated;
      return structuredClone(updated);
    });
  }

  async delete(id: EntityId): Promise<boolean> {
    return this.database.mutate((database) => {
      const rows = database[this.table] as unknown as T[];
      const index = rows.findIndex((row) => row.id === id);

      if (index === -1) {
        return false;
      }

      rows.splice(index, 1);
      return true;
    });
  }
}

class LocalUserRepository
  extends LocalCrudRepository<User>
  implements UserRepository
{
  constructor(database: JsonDatabase) {
    super(database, "users");
  }

  async findByUsername(username: string): Promise<User | null> {
    const normalized = username.trim().toLocaleLowerCase("pt-BR");
    const users = await this.list();
    return (
      users.find(
        (user) => user.username.toLocaleLowerCase("pt-BR") === normalized,
      ) ?? null
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLocaleLowerCase("pt-BR");
    const users = await this.list();
    return (
      users.find(
        (user) => user.email.toLocaleLowerCase("pt-BR") === normalized,
      ) ?? null
    );
  }
}

class LocalCampaignRepository
  extends LocalCrudRepository<Campaign>
  implements CampaignRepository
{
  constructor(database: JsonDatabase) {
    super(database, "campaigns");
  }

  override async create(
    input: CreateEntityInput<Campaign>,
  ): Promise<Campaign> {
    return this.database.mutate((database) => {
      if (
        database.campaigns.some(
          (campaign) => normalizedKey(campaign.slug) === normalizedKey(input.slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe uma campanha com este slug.",
        );
      }

      const now = new Date().toISOString();
      const campaign: Campaign = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.campaigns.push(campaign);
      return structuredClone(campaign);
    });
  }

  override async update(
    id: EntityId,
    input: UpdateEntityInput<Campaign>,
  ): Promise<Campaign | null> {
    return this.database.mutate((database) => {
      const index = database.campaigns.findIndex((campaign) => campaign.id === id);
      if (index === -1) {
        return null;
      }

      const nextSlug = input.slug ?? database.campaigns[index].slug;
      if (
        database.campaigns.some(
          (campaign) =>
            campaign.id !== id &&
            normalizedKey(campaign.slug) === normalizedKey(nextSlug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe uma campanha com este slug.",
        );
      }

      const current = database.campaigns[index];
      const updated: Campaign = {
        ...current,
        ...input,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      database.campaigns[index] = updated;
      return structuredClone(updated);
    });
  }

  override async delete(id: EntityId): Promise<boolean> {
    return (await this.deleteWithStorageKeys(id)).deleted;
  }

  async deleteWithStorageKeys(
    id: EntityId,
  ): Promise<{ deleted: boolean; storageKeys: string[] }> {
    return this.database.mutate((database) => {
      const index = database.campaigns.findIndex((campaign) => campaign.id === id);
      if (index === -1) {
        return { deleted: false, storageKeys: [] };
      }

      const campaign = database.campaigns[index];
      const campaignChapters = database.campaignChapters.filter(
        (item) => item.campaignId === id,
      );
      const campaignCharacters = database.characters.filter(
        (item) => item.campaignId === id,
      );
      const campaignClasses = database.characterClassOptions.filter(
        (item) => item.campaignId === id,
      );
      const campaignFiles = database.files.filter(
        (item) => item.campaignId === id,
      );
      const storageKeys = [
        campaign.coverImageStorageKey,
        campaign.backgroundImageStorageKey,
        ...campaignChapters.map((item) => item.backgroundImageStorageKey),
        ...campaignCharacters.flatMap((item) => [
          item.coverImageStorageKey,
          item.backgroundImageStorageKey,
        ]),
        ...campaignClasses.map((item) => item.logoImageStorageKey),
        ...campaignFiles.map((item) => item.storageKey),
      ].filter((key): key is string => Boolean(key));
      const characterIds = new Set(
        campaignCharacters.map((item) => item.id),
      );
      const teamIds = new Set(
        database.teams.filter((item) => item.campaignId === id).map((item) => item.id),
      );
      const missionIds = new Set(
        database.missions
          .filter((item) => item.campaignId === id)
          .map((item) => item.id),
      );
      const sessionIds = new Set(
        database.campaignSessions
          .filter((item) => item.campaignId === id)
          .map((item) => item.id),
      );
      const tableIds = new Set(
        database.virtualTables
          .filter((item) => item.campaignId === id)
          .map((item) => item.id),
      );
      const fileIds = new Set(
        campaignFiles.map((item) => item.id),
      );

      database.campaigns.splice(index, 1);
      database.campaignChapters = database.campaignChapters.filter(
        (item) => item.campaignId !== id,
      );
      database.campaignMembers = database.campaignMembers.filter(
        (item) => item.campaignId !== id,
      );
      database.characterStatusOptions = database.characterStatusOptions.filter(
        (item) => item.campaignId !== id,
      );
      database.characterClassOptions = database.characterClassOptions.filter(
        (item) => item.campaignId !== id,
      );
      database.characters = database.characters.filter(
        (item) => item.campaignId !== id,
      );
      database.teams = database.teams.filter((item) => item.campaignId !== id);
      database.teamMembers = database.teamMembers.filter(
        (item) => !teamIds.has(item.teamId) && !characterIds.has(item.characterId),
      );
      database.missions = database.missions.filter(
        (item) => item.campaignId !== id,
      );
      database.missionParticipants = database.missionParticipants.filter(
        (item) =>
          !missionIds.has(item.missionId) && !characterIds.has(item.characterId),
      );
      database.campaignSessions = database.campaignSessions.filter(
        (item) => item.campaignId !== id,
      );
      database.sessionParticipants = database.sessionParticipants.filter(
        (item) =>
          !sessionIds.has(item.sessionId) && !characterIds.has(item.characterId),
      );
      database.virtualTables = database.virtualTables.filter(
        (item) => item.campaignId !== id,
      );
      database.virtualTableMaps = database.virtualTableMaps.filter(
        (item) => item.campaignId !== id,
      );
      database.virtualTableTokens = database.virtualTableTokens.filter(
        (item) => !tableIds.has(item.tableId),
      );
      database.diceRolls = database.diceRolls.filter(
        (item) => item.campaignId !== id,
      );
      database.campaignEvents = database.campaignEvents.filter(
        (item) => item.campaignId !== id,
      );
      database.files = database.files.filter((item) => item.campaignId !== id);
      database.fileRelations = database.fileRelations.filter(
        (item) => !fileIds.has(item.fileId),
      );
      return structuredClone({ deleted: true, storageKeys });
    });
  }

  async findBySlug(slug: string): Promise<Campaign | null> {
    const campaigns = await this.list();
    return (
      campaigns.find(
        (campaign) => normalizedKey(campaign.slug) === normalizedKey(slug),
      ) ?? null
    );
  }

  async listForUser(userId: EntityId): Promise<Campaign[]> {
    const database = await this.database.read();
    const campaignIds = new Set(
      database.campaignMembers
        .filter(
          (membership) =>
            membership.userId === userId && membership.status === "approved",
        )
        .map((membership) => membership.campaignId),
    );
    return structuredClone(
      database.campaigns.filter((campaign) => campaignIds.has(campaign.id)),
    );
  }
}

class LocalCampaignMemberRepository
  extends LocalCrudRepository<CampaignMember>
  implements CampaignMemberRepository
{
  constructor(database: JsonDatabase) {
    super(database, "campaignMembers");
  }

  async listByCampaign(campaignId: EntityId): Promise<CampaignMember[]> {
    return (await this.list()).filter((item) => item.campaignId === campaignId);
  }

  async listByUser(userId: EntityId): Promise<CampaignMember[]> {
    return (await this.list()).filter((item) => item.userId === userId);
  }

  async requestAccess(
    campaignId: EntityId,
    userId: EntityId,
  ): Promise<CampaignMember> {
    return this.database.mutate((database) => {
      const campaignExists = database.campaigns.some(
        (campaign) => campaign.id === campaignId,
      );
      const user = database.users.find((candidate) => candidate.id === userId);

      if (!campaignExists) {
        throw new Error("CAMPAIGN_NOT_FOUND");
      }
      if (!user || user.status !== "active") {
        throw new Error("AUTH_REQUIRED");
      }

      const now = new Date().toISOString();
      const current = database.campaignMembers.find(
        (membership) =>
          membership.campaignId === campaignId && membership.userId === userId,
      );

      if (current?.status === "approved") {
        return structuredClone(current);
      }

      if (current) {
        current.role = "player";
        current.status = "pending";
        current.joinedAt = now;
        current.updatedAt = now;
        return structuredClone(current);
      }

      const membership: CampaignMember = {
        id: randomUUID(),
        campaignId,
        userId,
        role: "player",
        status: "pending",
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      database.campaignMembers.push(membership);
      return structuredClone(membership);
    });
  }

  async findMembership(
    campaignId: EntityId,
    userId: EntityId,
  ): Promise<CampaignMember | null> {
    const memberships = await this.listByCampaign(campaignId);
    return memberships.find((item) => item.userId === userId) ?? null;
  }
}

class LocalCampaignChapterRepository
  extends LocalCrudRepository<CampaignChapter>
  implements CampaignChapterRepository
{
  constructor(database: JsonDatabase) {
    super(database, "campaignChapters");
  }

  override async create(
    input: CreateEntityInput<CampaignChapter>,
  ): Promise<CampaignChapter> {
    return this.database.mutate((database) => {
      const progressionBefore = chapterProgressionCheckpoint(
        database,
        input.campaignId,
      );
      if (
        database.campaignChapters.some(
          (chapter) =>
            chapter.campaignId === input.campaignId &&
            normalizedKey(chapter.slug) === normalizedKey(input.slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe um capítulo com este slug nesta campanha.",
        );
      }
      const now = new Date().toISOString();
      const chapter: CampaignChapter = {
        ...input,
        completedAt: null,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.campaignChapters.push(chapter);
      assertOpenTableProgressionPreserved(
        database,
        input.campaignId,
        progressionBefore,
      );
      return structuredClone(chapter);
    });
  }

  override async update(
    id: EntityId,
    input: UpdateEntityInput<CampaignChapter>,
  ): Promise<CampaignChapter | null> {
    return this.database.mutate((database) => {
      const index = database.campaignChapters.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const current = database.campaignChapters[index];
      const campaignId = input.campaignId ?? current.campaignId;
      const affectedCampaignIds = [...new Set([current.campaignId, campaignId])];
      const progressionBefore = new Map(
        affectedCampaignIds.map((affectedCampaignId) => [
          affectedCampaignId,
          chapterProgressionCheckpoint(database, affectedCampaignId),
        ]),
      );
      const slug = input.slug ?? current.slug;
      if (
        database.campaignChapters.some(
          (item) =>
            item.id !== id &&
            item.campaignId === campaignId &&
            normalizedKey(item.slug) === normalizedKey(slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe um capítulo com este slug nesta campanha.",
        );
      }
      const updated: CampaignChapter = {
        ...current,
        ...input,
        completedAt: current.completedAt,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      database.campaignChapters[index] = updated;
      for (const affectedCampaignId of affectedCampaignIds) {
        assertOpenTableProgressionPreserved(
          database,
          affectedCampaignId,
          progressionBefore.get(affectedCampaignId)!,
        );
      }
      return structuredClone(updated);
    });
  }

  override async delete(id: EntityId): Promise<boolean> {
    return this.database.mutate((database) => {
      const index = database.campaignChapters.findIndex((item) => item.id === id);
      if (index === -1) return false;
      const chapter = database.campaignChapters[index];
      const progressionBefore = chapterProgressionCheckpoint(
        database,
        chapter.campaignId,
      );

      database.campaignChapters.splice(index, 1);
      assertOpenTableProgressionPreserved(
        database,
        chapter.campaignId,
        progressionBefore,
      );
      return true;
    });
  }

  async listByCampaign(campaignId: EntityId): Promise<CampaignChapter[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
  }

  async findBySlug(
    campaignId: EntityId,
    slug: string,
  ): Promise<CampaignChapter | null> {
    return (
      (await this.listByCampaign(campaignId)).find(
        (item) => normalizedKey(item.slug) === normalizedKey(slug),
      ) ?? null
    );
  }
}

abstract class LocalCharacterOptionRepository<
  T extends CharacterStatusOption | CharacterClassOption,
> extends LocalCrudRepository<T> {
  async listByCampaign(campaignId: EntityId): Promise<T[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }

  protected async createUnique(input: CreateEntityInput<T>): Promise<T> {
    return this.database.mutate((database) => {
      const rows = database[this.tableName()] as unknown as T[];
      if (
        rows.some(
          (item) =>
            item.campaignId === input.campaignId &&
            normalizedKey(item.slug) === normalizedKey(input.slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe uma opção com este slug nesta campanha.",
        );
      }
      const now = new Date().toISOString();
      const entity = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as unknown as T;
      rows.push(entity);
      return structuredClone(entity);
    });
  }

  protected async updateUnique(
    id: EntityId,
    input: UpdateEntityInput<T>,
  ): Promise<T | null> {
    return this.database.mutate((database) => {
      const rows = database[this.tableName()] as unknown as T[];
      const index = rows.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const current = rows[index];
      const campaignId = input.campaignId ?? current.campaignId;
      const slug = input.slug ?? current.slug;
      if (
        rows.some(
          (item) =>
            item.id !== id &&
            item.campaignId === campaignId &&
            normalizedKey(item.slug) === normalizedKey(slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe uma opção com este slug nesta campanha.",
        );
      }
      const updated = {
        ...current,
        ...input,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      } as unknown as T;
      rows[index] = updated;
      return structuredClone(updated);
    });
  }

  protected abstract tableName(): "characterStatusOptions" | "characterClassOptions";
}

class LocalCharacterStatusOptionRepository
  extends LocalCharacterOptionRepository<CharacterStatusOption>
  implements CharacterStatusOptionRepository
{
  constructor(database: JsonDatabase) {
    super(database, "characterStatusOptions");
  }
  protected tableName() {
    return "characterStatusOptions" as const;
  }
  override create(input: CreateEntityInput<CharacterStatusOption>) {
    return this.createUnique(input);
  }
  override update(id: EntityId, input: UpdateEntityInput<CharacterStatusOption>) {
    return this.updateUnique(id, input);
  }
  override async delete(id: EntityId): Promise<boolean> {
    return this.database.mutate((database) => {
      if (database.characters.some((item) => item.statusOptionId === id)) {
        throw new RepositoryConflictError(
          "option",
          "Esta opção está sendo usada por uma ficha.",
        );
      }
      const index = database.characterStatusOptions.findIndex((item) => item.id === id);
      if (index === -1) return false;
      database.characterStatusOptions.splice(index, 1);
      return true;
    });
  }
}

class LocalCharacterClassOptionRepository
  extends LocalCharacterOptionRepository<CharacterClassOption>
  implements CharacterClassOptionRepository
{
  constructor(database: JsonDatabase) {
    super(database, "characterClassOptions");
  }
  protected tableName() {
    return "characterClassOptions" as const;
  }
  override async create(input: CreateEntityInput<CharacterClassOption>) {
    assertCharacterAttributeBonuses(input.attributeBonuses);
    return this.createUnique(input);
  }
  override async update(
    id: EntityId,
    input: UpdateEntityInput<CharacterClassOption>,
  ) {
    if (input.attributeBonuses !== undefined) {
      assertCharacterAttributeBonuses(input.attributeBonuses);
    }
    return this.updateUnique(id, input);
  }
  override async delete(id: EntityId): Promise<boolean> {
    return this.database.mutate((database) => {
      if (database.characters.some((item) => item.classOptionId === id)) {
        throw new RepositoryConflictError(
          "option",
          "Esta opção está sendo usada por uma ficha.",
        );
      }
      const index = database.characterClassOptions.findIndex((item) => item.id === id);
      if (index === -1) return false;
      database.characterClassOptions.splice(index, 1);
      return true;
    });
  }
}

class LocalCharacterRepository
  extends LocalCrudRepository<Character>
  implements CharacterRepository
{
  constructor(database: JsonDatabase) {
    super(database, "characters");
  }

  override async create(
    input: CreateEntityInput<Character>,
  ): Promise<Character> {
    return this.database.mutate((database) => {
      const campaign = database.campaigns.find(
        (item) => item.id === input.campaignId,
      );
      if (!campaign) {
        throw new RepositoryConflictError(
          "campaignId",
          "A campanha informada não existe.",
        );
      }
      assertCharacterAttributes(input.attributes, campaign.slug);
      if (
        database.characters.some(
          (item) =>
            item.campaignId === input.campaignId &&
            normalizedKey(item.slug) === normalizedKey(input.slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe uma ficha com este slug nesta campanha.",
        );
      }
      const now = new Date().toISOString();
      const character: Character = {
        ...input,
        equipment: input.equipment ?? [],
        wounds: input.wounds ?? [],
        backpackItems: input.backpackItems ?? [],
        inventorySlots: input.inventorySlots ?? 8,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.characters.push(character);
      return structuredClone(character);
    });
  }

  override async update(
    id: EntityId,
    input: UpdateEntityInput<Character>,
  ): Promise<Character | null> {
    return this.database.mutate((database) => {
      const index = database.characters.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const current = database.characters[index];
      const campaignId = input.campaignId ?? current.campaignId;
      const campaign = database.campaigns.find((item) => item.id === campaignId);
      if (!campaign) {
        throw new RepositoryConflictError(
          "campaignId",
          "A campanha informada não existe.",
        );
      }
      assertCharacterAttributes(
        input.attributes ?? current.attributes,
        campaign.slug,
      );
      const slug = input.slug ?? current.slug;
      if (
        database.characters.some(
          (item) =>
            item.id !== id &&
            item.campaignId === campaignId &&
            normalizedKey(item.slug) === normalizedKey(slug),
        )
      ) {
        throw new RepositoryConflictError(
          "slug",
          "Já existe uma ficha com este slug nesta campanha.",
        );
      }
      const updated: Character = {
        ...current,
        ...input,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      database.characters[index] = updated;
      return structuredClone(updated);
    });
  }

  override async delete(id: EntityId): Promise<boolean> {
    return (await this.deleteWithTableFiles(id)).deleted;
  }

  async deleteWithTableFiles(
    id: EntityId,
  ): Promise<{ deleted: boolean; fileIds: EntityId[] }> {
    return this.database.mutate((database) => {
      const index = database.characters.findIndex((item) => item.id === id);
      if (index === -1) return { deleted: false, fileIds: [] };
      const characterTokens = database.virtualTableTokens.filter(
        (item) => item.characterId === id,
      );
      const fileIds = characterTokens.flatMap((item) =>
        item.imageFileId ? [item.imageFileId] : [],
      );
      database.characters.splice(index, 1);
      database.teamMembers = database.teamMembers.filter(
        (item) => item.characterId !== id,
      );
      database.missionParticipants = database.missionParticipants.filter(
        (item) => item.characterId !== id,
      );
      database.sessionParticipants = database.sessionParticipants.filter(
        (item) => item.characterId !== id,
      );
      const affectedTableIds = new Set(
        characterTokens.map((item) => item.tableId),
      );
      database.virtualTableTokens = database.virtualTableTokens.filter(
        (item) => item.characterId !== id,
      );
      const now = new Date().toISOString();
      database.virtualTables = database.virtualTables.map((table) =>
        affectedTableIds.has(table.id)
          ? {
              ...table,
              revision: table.revision + 1,
              updatedAt: now,
            }
          : table,
      );
      database.fileRelations = database.fileRelations.filter(
        (item) =>
          !(item.relationType === "character" && item.relationId === id),
      );
      return structuredClone({ deleted: true, fileIds });
    });
  }

  async listByCampaign(campaignId: EntityId): Promise<Character[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async findBySlug(
    campaignId: EntityId,
    slug: string,
  ): Promise<Character | null> {
    return (
      (await this.listByCampaign(campaignId)).find(
        (item) => normalizedKey(item.slug) === normalizedKey(slug),
      ) ?? null
    );
  }
}

class LocalTeamRepository
  extends LocalCrudRepository<Team>
  implements TeamRepository
{
  constructor(database: JsonDatabase) {
    super(database, "teams");
  }

  async listByCampaign(campaignId: EntityId): Promise<Team[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => left.order - right.order);
  }
}

class LocalTeamMemberRepository
  extends LocalCrudRepository<TeamMember>
  implements TeamMemberRepository
{
  constructor(database: JsonDatabase) {
    super(database, "teamMembers");
  }

  async listByTeam(teamId: EntityId): Promise<TeamMember[]> {
    return (await this.list())
      .filter((item) => item.teamId === teamId)
      .sort((left, right) => left.order - right.order);
  }
}

class LocalMissionRepository
  extends LocalCrudRepository<Mission>
  implements MissionRepository
{
  constructor(database: JsonDatabase) {
    super(database, "missions");
  }

  async listByCampaign(campaignId: EntityId): Promise<Mission[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => left.order - right.order);
  }
}

class LocalMissionParticipantRepository
  extends LocalCrudRepository<MissionParticipant>
  implements MissionParticipantRepository
{
  constructor(database: JsonDatabase) {
    super(database, "missionParticipants");
  }

  async listByMission(missionId: EntityId): Promise<MissionParticipant[]> {
    return (await this.list()).filter((item) => item.missionId === missionId);
  }
}

class LocalCampaignSessionRepository
  extends LocalCrudRepository<CampaignSession>
  implements CampaignSessionRepository
{
  constructor(database: JsonDatabase) {
    super(database, "campaignSessions");
  }

  override async create(
    input: CreateEntityInput<CampaignSession>,
  ): Promise<CampaignSession> {
    return this.database.mutate((database) => {
      if (
        database.campaignSessions.some(
          (item) =>
            item.campaignId === input.campaignId &&
            item.sessionNumber === input.sessionNumber,
        )
      ) {
        throw new RepositoryConflictError(
          "sessionNumber",
          "Já existe uma sessão com este número nesta campanha.",
        );
      }
      const now = new Date().toISOString();
      const session: CampaignSession = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.campaignSessions.push(session);
      return structuredClone(session);
    });
  }

  override async update(
    id: EntityId,
    input: UpdateEntityInput<CampaignSession>,
  ): Promise<CampaignSession | null> {
    return this.database.mutate((database) =>
      structuredClone(updateCampaignSessionRecord(database, id, input)),
    );
  }

  async updateAndCloseTable(
    id: EntityId,
    input: UpdateEntityInput<CampaignSession>,
  ): Promise<{ session: CampaignSession; table: VirtualTable | null } | null> {
    return this.database.mutate((database) => {
      const session = updateCampaignSessionRecord(database, id, input);
      if (!session) return null;
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.sessionId === id && item.status === "open",
      );
      const table =
        tableIndex === -1
          ? null
          : reviseVirtualTable(database, tableIndex, {
              status: "closed",
              closedAt: new Date().toISOString(),
            });
      return structuredClone({ session, table });
    });
  }

  async completeTableSession(
    tableId: EntityId,
    occurredAt: string,
  ): Promise<{ session: CampaignSession; table: VirtualTable } | null> {
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId,
      );
      if (tableIndex === -1) return null;
      const currentTable = database.virtualTables[tableIndex];
      const currentSession = database.campaignSessions.find(
        (item) =>
          item.id === currentTable.sessionId &&
          item.campaignId === currentTable.campaignId,
      );
      if (!currentSession) return null;

      if (currentTable.status === "closed") {
        return currentSession.status === "completed"
          ? structuredClone({ session: currentSession, table: currentTable })
          : null;
      }

      const session = updateCampaignSessionRecord(database, currentSession.id, {
        status: "completed",
        occurredAt: currentSession.occurredAt ?? occurredAt,
      });
      if (!session) return null;
      const table = reviseVirtualTable(database, tableIndex, {
        status: "closed",
        closedAt: new Date().toISOString(),
      });
      return structuredClone({ session, table });
    });
  }

  override async delete(id: EntityId): Promise<boolean> {
    return (await this.deleteWithTableFiles(id)).deleted;
  }

  async deleteWithTableFiles(
    id: EntityId,
  ): Promise<{ deleted: boolean; fileIds: EntityId[] }> {
    return this.database.mutate((database) => {
      const index = database.campaignSessions.findIndex((item) => item.id === id);
      if (index === -1) return { deleted: false, fileIds: [] };
      const sessionTables = database.virtualTables.filter(
        (item) => item.sessionId === id,
      );
      const tableIds = new Set(sessionTables.map((item) => item.id));
      const tableTokens = database.virtualTableTokens.filter((item) =>
        tableIds.has(item.tableId),
      );
      const fileIds = [
        ...sessionTables.flatMap((item) =>
          item.mapFileId ? [item.mapFileId] : [],
        ),
        ...tableTokens.flatMap((item) =>
          item.imageFileId ? [item.imageFileId] : [],
        ),
      ];
      database.campaignSessions.splice(index, 1);
      database.sessionParticipants = database.sessionParticipants.filter(
        (item) => item.sessionId !== id,
      );
      database.virtualTables = database.virtualTables.filter(
        (item) => item.sessionId !== id,
      );
      database.virtualTableTokens = database.virtualTableTokens.filter(
        (item) => !tableIds.has(item.tableId),
      );
      database.diceRolls = database.diceRolls.filter(
        (item) => item.sessionId !== id,
      );
      database.fileRelations = database.fileRelations.filter(
        (item) =>
          !(item.relationType === "session" && item.relationId === id),
      );
      return structuredClone({ deleted: true, fileIds });
    });
  }

  async listByCampaign(campaignId: EntityId): Promise<CampaignSession[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => right.sessionNumber - left.sessionNumber);
  }
}

class LocalSessionParticipantRepository
  extends LocalCrudRepository<SessionParticipant>
  implements SessionParticipantRepository
{
  constructor(database: JsonDatabase) {
    super(database, "sessionParticipants");
  }

  async listBySession(sessionId: EntityId): Promise<SessionParticipant[]> {
    return (await this.list()).filter((item) => item.sessionId === sessionId);
  }
}

class LocalCampaignEventRepository
  extends LocalCrudRepository<CampaignEvent>
  implements CampaignEventRepository
{
  constructor(database: JsonDatabase) {
    super(database, "campaignEvents");
  }

  async listByCampaign(campaignId: EntityId): Promise<CampaignEvent[]> {
    return (await this.list())
      .filter((item) => item.campaignId === campaignId)
      .sort((left, right) => left.order - right.order);
  }
}

class LocalFileRepository
  extends LocalCrudRepository<GameFile>
  implements FileRepository
{
  constructor(database: JsonDatabase) {
    super(database, "files");
  }

  async listByCampaign(campaignId: EntityId): Promise<GameFile[]> {
    return (await this.list()).filter((item) => item.campaignId === campaignId);
  }
}

class LocalFileRelationRepository
  extends LocalCrudRepository<FileRelation>
  implements FileRelationRepository
{
  constructor(database: JsonDatabase) {
    super(database, "fileRelations");
  }

  async listByFile(fileId: EntityId): Promise<FileRelation[]> {
    return (await this.list()).filter((item) => item.fileId === fileId);
  }
}

class LocalTabletopRepository implements TabletopRepository {
  constructor(private readonly database: JsonDatabase) {}

  async findOpenByCampaign(campaignId: EntityId): Promise<VirtualTable | null> {
    const database = await this.database.read();
    const table = database.virtualTables
      .filter((item) => item.campaignId === campaignId && item.status === "open")
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt))[0];
    return table ? structuredClone(table) : null;
  }

  async findBySession(sessionId: EntityId): Promise<VirtualTable | null> {
    const database = await this.database.read();
    const table = database.virtualTables.find((item) => item.sessionId === sessionId);
    return table ? structuredClone(table) : null;
  }

  async findById(id: EntityId): Promise<VirtualTable | null> {
    const database = await this.database.read();
    const table = database.virtualTables.find((item) => item.id === id);
    return table ? structuredClone(table) : null;
  }

  async open(input: OpenVirtualTableInput): Promise<VirtualTable> {
    return this.database.mutate((database) => {
      const session = database.campaignSessions.find(
        (item) =>
          item.id === input.sessionId && item.campaignId === input.campaignId,
      );
      if (!session) {
        throw new RepositoryConflictError(
          "session",
          "A sessão selecionada não pertence a esta campanha.",
        );
      }
      if (session.status !== "scheduled") {
        throw new RepositoryConflictError(
          "session",
          "Somente uma sessão agendada pode abrir uma mesa.",
        );
      }

      const openTable = database.virtualTables.find(
        (item) => item.campaignId === input.campaignId && item.status === "open",
      );
      if (openTable && openTable.sessionId !== input.sessionId) {
        throw new RepositoryConflictError(
          "table",
          "Já existe uma mesa aberta nesta campanha.",
        );
      }
      if (openTable) {
        return structuredClone(openTable);
      }

      const existingIndex = database.virtualTables.findIndex(
        (item) => item.sessionId === input.sessionId,
      );
      const now = new Date().toISOString();
      if (existingIndex !== -1) {
        return structuredClone(
          reviseVirtualTable(database, existingIndex, {
            status: "open",
            openedByUserId: input.openedByUserId,
            openedAt: now,
            closedAt: null,
          }),
        );
      }

      const table: VirtualTable = {
        id: randomUUID(),
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        status: "open",
        mapFileId: null,
        activeMapId:
          database.virtualTableMaps
            .filter((map) => map.campaignId === input.campaignId)
            .sort((left, right) => left.order - right.order)[0]?.id ?? null,
        lastChapterTransition: null,
        revision: 1,
        openedByUserId: input.openedByUserId,
        openedAt: now,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      database.virtualTables.push(table);
      return structuredClone(table);
    });
  }

  async setMapFile(
    tableId: EntityId,
    mapFileId: EntityId | null,
  ): Promise<{ table: VirtualTable; previousMapFileId: EntityId | null } | null> {
    return this.database.mutate((database) => {
      const index = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      if (index === -1) return null;
      const current = database.virtualTables[index];
      if (
        mapFileId &&
        !database.files.some(
          (file) => file.id === mapFileId && file.campaignId === current.campaignId,
        )
      ) {
        throw new RepositoryConflictError(
          "mapFileId",
          "O mapa selecionado não pertence a esta campanha.",
        );
      }
      const previousMapFileId = current.mapFileId;
      const table = reviseVirtualTable(database, index, {
        mapFileId,
        activeMapId: null,
      });
      return structuredClone({ table, previousMapFileId });
    });
  }

  async listMapsByCampaign(campaignId: EntityId): Promise<VirtualTableMap[]> {
    const database = await this.database.read();
    return structuredClone(
      database.virtualTableMaps
        .filter((map) => map.campaignId === campaignId)
        .sort(
          (left, right) =>
            left.order - right.order ||
            left.groupName.localeCompare(right.groupName) ||
            left.layerName.localeCompare(right.layerName),
        ),
    );
  }

  async findMapById(mapId: EntityId): Promise<VirtualTableMap | null> {
    const database = await this.database.read();
    const map = database.virtualTableMaps.find((item) => item.id === mapId);
    return map ? structuredClone(map) : null;
  }

  async createMap(
    input: CreateEntityInput<VirtualTableMap>,
  ): Promise<VirtualTableMap> {
    if (!input.imageFileId && !input.builtInImageUrl) {
      throw new RepositoryConflictError("image", "O mapa precisa de uma imagem.");
    }
    if (input.builtIn && !input.builtInImageUrl) {
      throw new RepositoryConflictError("image", "Um mapa interno precisa de uma imagem estática.");
    }
    if (!Number.isFinite(input.order)) {
      throw new RepositoryConflictError("order", "A ordem do mapa é inválida.");
    }
    return this.database.mutate((database) => {
      if (!database.campaigns.some((item) => item.id === input.campaignId)) {
        throw new RepositoryConflictError("campaignId", "Campanha não encontrada.");
      }
      if (
        input.imageFileId &&
        !database.files.some(
          (file) => file.id === input.imageFileId && file.campaignId === input.campaignId,
        )
      ) {
        throw new RepositoryConflictError("imageFileId", "A imagem não pertence a esta campanha.");
      }
      const now = new Date().toISOString();
      const map: VirtualTableMap = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.virtualTableMaps.push(map);
      return structuredClone(map);
    });
  }

  async activateMap(
    tableId: EntityId,
    mapId: EntityId,
  ): Promise<{ table: VirtualTable; map: VirtualTableMap } | null> {
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      if (tableIndex === -1) return null;
      const current = database.virtualTables[tableIndex];
      const map = database.virtualTableMaps.find(
        (item) => item.id === mapId && item.campaignId === current.campaignId,
      );
      if (!map) {
        throw new RepositoryConflictError("mapId", "O mapa não pertence a esta campanha.");
      }
      const table = reviseVirtualTable(database, tableIndex, { activeMapId: map.id });
      return structuredClone({ table, map });
    });
  }

  async advanceChapter(
    input: AdvanceVirtualTableChapterInput,
  ): Promise<{
    table: VirtualTable;
    completedChapter: CampaignChapter;
    nextChapter: CampaignChapter | null;
    map: VirtualTableMap | null;
  } | null> {
    if (Number.isNaN(Date.parse(input.completedAt))) {
      throw new RepositoryConflictError(
        "completedAt",
        "A data de conclusão do capítulo é inválida.",
      );
    }

    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (table) => table.id === input.tableId && table.status === "open",
      );
      if (tableIndex === -1) return null;

      const currentTable = database.virtualTables[tableIndex];
      const campaign = database.campaigns.find(
        (candidate) => candidate.id === currentTable.campaignId,
      );
      const requester = database.users.find(
        (candidate) =>
          candidate.id === input.requestedByUserId &&
          candidate.status === "active",
      );
      const requesterMembership = database.campaignMembers.find(
        (membership) =>
          membership.campaignId === currentTable.campaignId &&
          membership.userId === input.requestedByUserId,
      );
      if (
        !campaign ||
        !requester ||
        !canManageCampaign(requester, campaign, requesterMembership ?? null)
      ) {
        throw new RepositoryConflictError(
          "authorization",
          "Somente o mestre pode avançar o capítulo.",
        );
      }
      const publishedChapters = database.campaignChapters
        .filter(
          (chapter) =>
            chapter.campaignId === currentTable.campaignId &&
            chapter.status === "published",
        )
        .slice()
        .sort(compareCampaignChapters);
      const currentChapterIndex = publishedChapters.findIndex(
        (chapter) => chapter.completedAt === null,
      );
      const currentChapter = publishedChapters[currentChapterIndex];

      if (!currentChapter) {
        throw new RepositoryConflictError(
          "chapter",
          "Todos os capítulos publicados já foram concluídos.",
        );
      }
      if (currentChapter.id !== input.currentChapterId) {
        throw new RepositoryConflictError(
          "chapter",
          "O capítulo da mesa mudou. Atualize a página antes de avançar.",
        );
      }

      const nextChapter = publishedChapters[currentChapterIndex + 1] ?? null;
      if ((nextChapter?.id ?? null) !== input.nextChapterId) {
        throw new RepositoryConflictError(
          "chapter",
          "A ordem dos capítulos mudou. Atualize a mesa antes de concluir.",
        );
      }

      const map = input.mapId
        ? database.virtualTableMaps.find(
            (candidate) =>
              candidate.id === input.mapId &&
              candidate.campaignId === currentTable.campaignId,
          ) ?? null
        : null;
      if (nextChapter && !map) {
        throw new RepositoryConflictError(
          "mapId",
          "Escolha um mapa da campanha para iniciar o próximo capítulo.",
        );
      }
      if (!nextChapter && input.mapId !== null) {
        throw new RepositoryConflictError(
          "mapId",
          "O último capítulo não precisa de um novo mapa.",
        );
      }

      const storedChapterIndex = database.campaignChapters.findIndex(
        (chapter) => chapter.id === currentChapter.id,
      );
      const completedChapter: CampaignChapter = {
        ...currentChapter,
        completedAt: input.completedAt,
        updatedAt: input.completedAt,
      };
      database.campaignChapters[storedChapterIndex] = completedChapter;
      const chapterTransition = {
        id: randomUUID(),
        fromChapterId: currentChapter.id,
        toChapterId: nextChapter?.id ?? null,
        mapId: map?.id ?? currentTable.activeMapId,
        occurredAt: input.completedAt,
      };
      const table = reviseVirtualTable(database, tableIndex, {
        activeMapId: map?.id ?? currentTable.activeMapId,
        mapFileId: map ? null : currentTable.mapFileId,
        lastChapterTransition: chapterTransition,
      });

      return structuredClone({
        table,
        completedChapter,
        nextChapter,
        map,
      });
    });
  }

  async rollbackChapter(
    input: RollbackVirtualTableChapterInput,
  ): Promise<{
    table: VirtualTable;
    restoredChapter: CampaignChapter;
    formerCurrentChapter: CampaignChapter | null;
  } | null> {
    if (Number.isNaN(Date.parse(input.occurredAt))) {
      throw new RepositoryConflictError(
        "occurredAt",
        "A data da mudança de capítulo é inválida.",
      );
    }

    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (table) => table.id === input.tableId && table.status === "open",
      );
      if (tableIndex === -1) return null;

      const currentTable = database.virtualTables[tableIndex];
      const campaign = database.campaigns.find(
        (candidate) => candidate.id === currentTable.campaignId,
      );
      const requester = database.users.find(
        (candidate) =>
          candidate.id === input.requestedByUserId &&
          candidate.status === "active",
      );
      const requesterMembership = database.campaignMembers.find(
        (membership) =>
          membership.campaignId === currentTable.campaignId &&
          membership.userId === input.requestedByUserId,
      );
      if (
        !campaign ||
        !requester ||
        !canManageCampaign(requester, campaign, requesterMembership ?? null)
      ) {
        throw new RepositoryConflictError(
          "authorization",
          "Somente o mestre pode voltar o capítulo.",
        );
      }

      const publishedChapters = database.campaignChapters
        .filter(
          (chapter) =>
            chapter.campaignId === currentTable.campaignId &&
            chapter.status === "published",
        )
        .slice()
        .sort(compareCampaignChapters);
      const firstIncompleteIndex = publishedChapters.findIndex(
        (chapter) => chapter.completedAt === null,
      );
      const formerCurrentChapter =
        firstIncompleteIndex === -1
          ? null
          : publishedChapters[firstIncompleteIndex] ?? null;
      if ((formerCurrentChapter?.id ?? null) !== input.currentChapterId) {
        throw new RepositoryConflictError(
          "chapter",
          "O capítulo da mesa mudou. Atualize a página antes de voltar.",
        );
      }

      const previousIndex =
        firstIncompleteIndex === -1
          ? publishedChapters.length - 1
          : firstIncompleteIndex - 1;
      const previousChapter = publishedChapters[previousIndex] ?? null;
      if (!previousChapter || previousChapter.completedAt === null) {
        throw new RepositoryConflictError(
          "chapter",
          "Não existe um capítulo concluído para restaurar.",
        );
      }
      if (previousChapter.id !== input.previousChapterId) {
        throw new RepositoryConflictError(
          "chapter",
          "A ordem dos capítulos mudou. Atualize a mesa antes de voltar.",
        );
      }

      const storedChapterIndex = database.campaignChapters.findIndex(
        (chapter) => chapter.id === previousChapter.id,
      );
      const restoredChapter: CampaignChapter = {
        ...previousChapter,
        completedAt: null,
        updatedAt: input.occurredAt,
      };
      database.campaignChapters[storedChapterIndex] = restoredChapter;

      const table = reviseVirtualTable(database, tableIndex, {
        lastChapterTransition: {
          id: randomUUID(),
          fromChapterId: formerCurrentChapter?.id ?? previousChapter.id,
          toChapterId: previousChapter.id,
          mapId: currentTable.activeMapId,
          occurredAt: input.occurredAt,
        },
      });

      return structuredClone({
        table,
        restoredChapter,
        formerCurrentChapter,
      });
    });
  }

  async deleteMap(
    mapId: EntityId,
  ): Promise<{ deleted: boolean; fileId: EntityId | null }> {
    return this.database.mutate((database) => {
      const index = database.virtualTableMaps.findIndex((item) => item.id === mapId);
      if (index === -1) return { deleted: false, fileId: null };
      const map = database.virtualTableMaps[index];
      if (map.builtIn) {
        throw new RepositoryConflictError("mapId", "Os mapas internos da campanha não podem ser excluídos.");
      }
      if (database.virtualTableTokens.some((token) => token.mapId === map.id)) {
        throw new RepositoryConflictError(
          "mapId",
          "Este mapa ainda possui tokens. Mova-os para outra camada antes de excluir.",
        );
      }
      database.virtualTableMaps.splice(index, 1);
      const fallbackId = database.virtualTableMaps
        .filter((item) => item.campaignId === map.campaignId)
        .sort((left, right) => left.order - right.order)[0]?.id ?? null;
      const now = new Date().toISOString();
      database.virtualTables = database.virtualTables.map((table) =>
        table.activeMapId === map.id
          ? {
              ...table,
              activeMapId: fallbackId,
              revision: table.revision + 1,
              updatedAt: now,
            }
          : table,
      );
      return structuredClone({ deleted: true, fileId: map.imageFileId });
    });
  }

  async listTokens(tableId: EntityId): Promise<VirtualTableToken[]> {
    const database = await this.database.read();
    return structuredClone(
      database.virtualTableTokens
        .filter((item) => item.tableId === tableId)
        .sort(
          (left, right) =>
            left.zIndex - right.zIndex || left.createdAt.localeCompare(right.createdAt),
        ),
    );
  }

  async listTokensByCharacter(characterId: EntityId): Promise<VirtualTableToken[]> {
    const database = await this.database.read();
    return structuredClone(
      database.virtualTableTokens.filter(
        (item) => item.characterId === characterId,
      ),
    );
  }

  async findTokenById(tokenId: EntityId): Promise<VirtualTableToken | null> {
    const database = await this.database.read();
    const token = database.virtualTableTokens.find((item) => item.id === tokenId);
    return token ? structuredClone(token) : null;
  }

  async createToken(
    input: CreateEntityInput<VirtualTableToken>,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken }> {
    const result = await this.createTokens([input]);
    return { table: result.table, token: result.tokens[0]! };
  }

  async createTokens(
    inputs: CreateEntityInput<VirtualTableToken>[],
  ): Promise<{ table: VirtualTable; tokens: VirtualTableToken[] }> {
    if (inputs.length < 1 || inputs.length > 20) {
      throw new RepositoryConflictError(
        "quantity",
        "Crie entre 1 e 20 tokens por vez.",
      );
    }
    const tableId = inputs[0]!.tableId;
    if (inputs.some((input) => input.tableId !== tableId)) {
      throw new RepositoryConflictError(
        "table",
        "Todos os tokens precisam pertencer à mesma mesa.",
      );
    }
    for (const input of inputs) {
      assertNormalizedCoordinate(input.x);
      assertNormalizedCoordinate(input.y);
      assertTokenCustomization(input);
      if (!Number.isInteger(input.zIndex) || input.zIndex < 0) {
        throw new RepositoryConflictError(
          "zIndex",
          "A ordem visual do token é inválida.",
        );
      }
    }
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      if (tableIndex === -1) {
        throw new RepositoryConflictError("table", "A mesa não está aberta.");
      }
      const currentTable = database.virtualTables[tableIndex];
      const tokens: VirtualTableToken[] = [];

      for (const input of inputs) {
        const mapId = input.mapId ?? currentTable.activeMapId;
        if (
          mapId &&
          !database.virtualTableMaps.some(
            (map) =>
              map.id === mapId && map.campaignId === currentTable.campaignId,
          )
        ) {
          throw new RepositoryConflictError(
            "mapId",
            "O mapa do token não pertence a esta campanha.",
          );
        }
        if (input.characterId) {
          if (input.kind !== "character") {
            throw new RepositoryConflictError(
              "kind",
              "Um token associado a uma ficha deve ser do tipo personagem.",
            );
          }
          const character = database.characters.find(
            (item) =>
              item.id === input.characterId &&
              item.campaignId === currentTable.campaignId,
          );
          if (!character) {
            throw new RepositoryConflictError(
              "characterId",
              "O personagem não pertence a esta campanha.",
            );
          }
        } else if (input.kind === "character") {
          throw new RepositoryConflictError(
            "characterId",
            "Um token de personagem precisa estar associado a uma ficha.",
          );
        }
        if (
          input.imageFileId &&
          !database.files.some(
            (file) =>
              file.id === input.imageFileId &&
              file.campaignId === currentTable.campaignId,
          )
        ) {
          throw new RepositoryConflictError(
            "imageFileId",
            "A imagem do token não pertence a esta campanha.",
          );
        }
        if (
          input.characterId &&
          database.virtualTableTokens.some(
            (item) =>
              item.tableId === input.tableId &&
              item.characterId === input.characterId,
          )
        ) {
          throw new RepositoryConflictError(
            "characterId",
            "Este personagem já possui um token na mesa.",
          );
        }
        const now = new Date().toISOString();
        const token: VirtualTableToken = {
          ...input,
          mapId,
          disposition:
            input.disposition ??
            (input.kind === "character"
              ? "player"
              : input.kind === "enemy"
                ? "hostile"
                : input.kind === "object"
                  ? "object"
                  : "ally"),
          accentColor:
            input.accentColor ??
            (input.kind === "enemy"
              ? "#d45a4f"
              : input.kind === "object"
                ? "#d6a45d"
                : "#5ea7a0"),
          notes: input.notes ?? "",
          collectible: input.collectible ?? false,
          rotation: input.rotation ?? 0,
          visionEnabled: input.visionEnabled ?? input.kind !== "object",
          visionAngle: input.visionAngle ?? 70,
          visionRange: input.visionRange ?? 0.22,
          visionColor:
            input.visionColor ??
            input.accentColor ??
            (input.kind === "enemy"
              ? "#d45a4f"
              : input.kind === "object"
                ? "#d6a45d"
                : "#5ea7a0"),
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        database.virtualTableTokens.push(token);
        tokens.push(token);
        reviseVirtualTable(database, tableIndex);
      }

      return structuredClone({
        table: database.virtualTables[tableIndex],
        tokens,
      });
    });
  }

  async moveToken(
    tableId: EntityId,
    tokenId: EntityId,
    x: number,
    y: number,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    assertNormalizedCoordinate(x);
    assertNormalizedCoordinate(y);
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      const tokenIndex = database.virtualTableTokens.findIndex(
        (item) => item.id === tokenId && item.tableId === tableId,
      );
      if (tableIndex === -1 || tokenIndex === -1) return null;
      const current = database.virtualTableTokens[tokenIndex];
      const token: VirtualTableToken = {
        ...current,
        x,
        y,
        updatedAt: new Date().toISOString(),
      };
      database.virtualTableTokens[tokenIndex] = token;
      const table = reviseVirtualTable(database, tableIndex);
      return structuredClone({ table, token });
    });
  }

  async setTokenVisibility(
    tableId: EntityId,
    tokenId: EntityId,
    visible: boolean,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      const tokenIndex = database.virtualTableTokens.findIndex(
        (item) => item.id === tokenId && item.tableId === tableId,
      );
      if (tableIndex === -1 || tokenIndex === -1) return null;
      const current = database.virtualTableTokens[tokenIndex];
      const token: VirtualTableToken = {
        ...current,
        visible,
        updatedAt: new Date().toISOString(),
      };
      database.virtualTableTokens[tokenIndex] = token;
      const table = reviseVirtualTable(database, tableIndex);
      return structuredClone({ table, token });
    });
  }

  async updateToken(
    tableId: EntityId,
    tokenId: EntityId,
    input: Partial<
      Pick<
        VirtualTableToken,
        | "name"
        | "mapId"
        | "kind"
        | "disposition"
        | "size"
        | "visible"
        | "accentColor"
        | "notes"
        | "collectible"
        | "rotation"
        | "visionEnabled"
        | "visionAngle"
        | "visionRange"
        | "visionColor"
      >
    >,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    assertTokenCustomization(input);
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      const tokenIndex = database.virtualTableTokens.findIndex(
        (item) => item.id === tokenId && item.tableId === tableId,
      );
      if (tableIndex === -1 || tokenIndex === -1) return null;
      const current = database.virtualTableTokens[tokenIndex];
      const currentTable = database.virtualTables[tableIndex];
      if (
        input.mapId !== undefined &&
        input.mapId !== null &&
        !database.virtualTableMaps.some(
          (map) =>
            map.id === input.mapId &&
            map.campaignId === currentTable.campaignId,
        )
      ) {
        throw new RepositoryConflictError(
          "mapId",
          "O mapa de destino não pertence a esta campanha.",
        );
      }
      if (current.characterId && input.kind && input.kind !== "character") {
        throw new RepositoryConflictError(
          "kind",
          "Um token associado a uma ficha deve continuar como personagem.",
        );
      }
      if (!current.characterId && input.kind === "character") {
        throw new RepositoryConflictError(
          "kind",
          "Associe uma ficha antes de usar o tipo personagem.",
        );
      }
      const token: VirtualTableToken = {
        ...current,
        ...input,
        id: current.id,
        tableId: current.tableId,
        mapId: input.mapId === undefined ? current.mapId : input.mapId,
        characterId: current.characterId,
        imageFileId: current.imageFileId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      database.virtualTableTokens[tokenIndex] = token;
      const table = reviseVirtualTable(database, tableIndex);
      return structuredClone({ table, token });
    });
  }

  async deleteToken(
    tableId: EntityId,
    tokenId: EntityId,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) => item.id === tableId && item.status === "open",
      );
      const tokenIndex = database.virtualTableTokens.findIndex(
        (item) => item.id === tokenId && item.tableId === tableId,
      );
      if (tableIndex === -1 || tokenIndex === -1) return null;
      const [token] = database.virtualTableTokens.splice(tokenIndex, 1);
      const table = reviseVirtualTable(database, tableIndex);
      return structuredClone({ table, token });
    });
  }

  async listRolls(tableId: EntityId, limit = 30): Promise<DiceRoll[]> {
    const database = await this.database.read();
    return structuredClone(
      database.diceRolls
        .filter((item) => item.tableId === tableId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, Math.max(0, limit)),
    );
  }

  async createRoll(
    input: CreateEntityInput<DiceRoll>,
  ): Promise<{ table: VirtualTable; roll: DiceRoll }> {
    return this.database.mutate((database) => {
      const tableIndex = database.virtualTables.findIndex(
        (item) =>
          item.id === input.tableId &&
          item.status === "open" &&
          item.campaignId === input.campaignId &&
          item.sessionId === input.sessionId,
      );
      if (tableIndex === -1) {
        throw new RepositoryConflictError("table", "A mesa não está aberta.");
      }
      const now = new Date().toISOString();
      const roll: DiceRoll = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.diceRolls.push(roll);
      const newestRollIds = new Set(
        database.diceRolls
          .filter((item) => item.tableId === input.tableId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 100)
          .map((item) => item.id),
      );
      database.diceRolls = database.diceRolls.filter(
        (item) => item.tableId !== input.tableId || newestRollIds.has(item.id),
      );
      const table = reviseVirtualTable(database, tableIndex);
      return structuredClone({ table, roll });
    });
  }
}

class LocalDashboardSummaryRepository
  implements DashboardSummaryRepository
{
  constructor(private readonly database: JsonDatabase) {}

  async getContentCounts() {
    const database = await this.database.read();
    return {
      campaigns: database.campaigns.length,
      users: database.users.length,
      characters: database.characters.length,
      teams: database.teams.length,
      missions: database.missions.length,
      sessions: database.campaignSessions.length,
      events: database.campaignEvents.length,
      files: database.files.length,
    };
  }
}

export function createLocalRepositories(
  database: JsonDatabase,
): RepositoryRegistry {
  return {
    users: new LocalUserRepository(database),
    campaigns: new LocalCampaignRepository(database),
    campaignChapters: new LocalCampaignChapterRepository(database),
    campaignMembers: new LocalCampaignMemberRepository(database),
    characters: new LocalCharacterRepository(database),
    characterStatusOptions: new LocalCharacterStatusOptionRepository(database),
    characterClassOptions: new LocalCharacterClassOptionRepository(database),
    teams: new LocalTeamRepository(database),
    teamMembers: new LocalTeamMemberRepository(database),
    missions: new LocalMissionRepository(database),
    missionParticipants: new LocalMissionParticipantRepository(database),
    campaignSessions: new LocalCampaignSessionRepository(database),
    sessionParticipants: new LocalSessionParticipantRepository(database),
    campaignEvents: new LocalCampaignEventRepository(database),
    files: new LocalFileRepository(database),
    fileRelations: new LocalFileRelationRepository(database),
    tabletop: new LocalTabletopRepository(database),
    dashboardSummary: new LocalDashboardSummaryRepository(database),
  };
}
