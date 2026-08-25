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

type RequiredCreateEntityInput<T extends EntityBase> = Omit<
  T,
  "id" | "createdAt" | "updatedAt"
>;

type CharacterLoadoutFields =
  | "equipment"
  | "wounds"
  | "backpackItems"
  | "inventorySlots";
type TokenCustomizationFields =
  | "mapId"
  | "disposition"
  | "accentColor"
  | "notes"
  | "collectible"
  | "rotation"
  | "visionEnabled"
  | "visionAngle"
  | "visionRange"
  | "visionColor";

export type CreateEntityInput<T extends EntityBase> = T extends CampaignChapter
  ? Omit<RequiredCreateEntityInput<T>, "completedAt">
  : T extends Character
  ? Omit<RequiredCreateEntityInput<T>, CharacterLoadoutFields> &
      Partial<Pick<Character, CharacterLoadoutFields>>
  : T extends VirtualTableToken
    ? Omit<RequiredCreateEntityInput<T>, TokenCustomizationFields> &
        Partial<Pick<VirtualTableToken, TokenCustomizationFields>>
    : RequiredCreateEntityInput<T>;

export type UpdateEntityInput<T extends EntityBase> = Partial<
  CreateEntityInput<T>
>;

export class RepositoryConflictError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

export interface CrudRepository<T extends EntityBase> {
  list(): Promise<T[]>;
  findById(id: EntityId): Promise<T | null>;
  create(input: CreateEntityInput<T>): Promise<T>;
  update(id: EntityId, input: UpdateEntityInput<T>): Promise<T | null>;
  delete(id: EntityId): Promise<boolean>;
}

export interface UserRepository extends CrudRepository<User> {
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

export interface CampaignRepository extends CrudRepository<Campaign> {
  findBySlug(slug: string): Promise<Campaign | null>;
  listForUser(userId: EntityId): Promise<Campaign[]>;
  deleteWithStorageKeys(
    id: EntityId,
  ): Promise<{ deleted: boolean; storageKeys: string[] }>;
}

export interface CampaignChapterRepository
  extends CrudRepository<CampaignChapter> {
  listByCampaign(campaignId: EntityId): Promise<CampaignChapter[]>;
  findBySlug(
    campaignId: EntityId,
    slug: string,
  ): Promise<CampaignChapter | null>;
}

export interface CampaignMemberRepository
  extends CrudRepository<CampaignMember> {
  listByCampaign(campaignId: EntityId): Promise<CampaignMember[]>;
  listByUser(userId: EntityId): Promise<CampaignMember[]>;
  requestAccess(
    campaignId: EntityId,
    userId: EntityId,
  ): Promise<CampaignMember>;
  findMembership(
    campaignId: EntityId,
    userId: EntityId,
  ): Promise<CampaignMember | null>;
}

export interface CharacterRepository extends CrudRepository<Character> {
  listByCampaign(campaignId: EntityId): Promise<Character[]>;
  findBySlug(campaignId: EntityId, slug: string): Promise<Character | null>;
  deleteWithTableFiles(
    id: EntityId,
  ): Promise<{ deleted: boolean; fileIds: EntityId[] }>;
}

export interface CharacterStatusOptionRepository
  extends CrudRepository<CharacterStatusOption> {
  listByCampaign(campaignId: EntityId): Promise<CharacterStatusOption[]>;
}

export interface CharacterClassOptionRepository
  extends CrudRepository<CharacterClassOption> {
  listByCampaign(campaignId: EntityId): Promise<CharacterClassOption[]>;
}

export interface TeamRepository extends CrudRepository<Team> {
  listByCampaign(campaignId: EntityId): Promise<Team[]>;
}

export interface TeamMemberRepository extends CrudRepository<TeamMember> {
  listByTeam(teamId: EntityId): Promise<TeamMember[]>;
}

export interface MissionRepository extends CrudRepository<Mission> {
  listByCampaign(campaignId: EntityId): Promise<Mission[]>;
}

export interface MissionParticipantRepository
  extends CrudRepository<MissionParticipant> {
  listByMission(missionId: EntityId): Promise<MissionParticipant[]>;
}

export interface CampaignSessionRepository
  extends CrudRepository<CampaignSession> {
  listByCampaign(campaignId: EntityId): Promise<CampaignSession[]>;
  updateAndCloseTable(
    id: EntityId,
    input: UpdateEntityInput<CampaignSession>,
  ): Promise<{ session: CampaignSession; table: VirtualTable | null } | null>;
  completeTableSession(
    tableId: EntityId,
    occurredAt: string,
  ): Promise<{ session: CampaignSession; table: VirtualTable } | null>;
  deleteWithTableFiles(
    id: EntityId,
  ): Promise<{ deleted: boolean; fileIds: EntityId[] }>;
}

export interface SessionParticipantRepository
  extends CrudRepository<SessionParticipant> {
  listBySession(sessionId: EntityId): Promise<SessionParticipant[]>;
}

export interface CampaignEventRepository
  extends CrudRepository<CampaignEvent> {
  listByCampaign(campaignId: EntityId): Promise<CampaignEvent[]>;
}

export interface FileRepository extends CrudRepository<GameFile> {
  listByCampaign(campaignId: EntityId): Promise<GameFile[]>;
}

export interface FileRelationRepository
  extends CrudRepository<FileRelation> {
  listByFile(fileId: EntityId): Promise<FileRelation[]>;
}

export interface ContentCounts {
  campaigns: number;
  users: number;
  characters: number;
  teams: number;
  missions: number;
  sessions: number;
  events: number;
  files: number;
}

export interface DashboardSummaryRepository {
  getContentCounts(): Promise<ContentCounts>;
}

export interface OpenVirtualTableInput {
  campaignId: EntityId;
  sessionId: EntityId;
  openedByUserId: EntityId;
}

export interface AdvanceVirtualTableChapterInput {
  tableId: EntityId;
  currentChapterId: EntityId;
  nextChapterId: EntityId | null;
  mapId: EntityId | null;
  requestedByUserId: EntityId;
  completedAt: string;
}

export interface TabletopRepository {
  findOpenByCampaign(campaignId: EntityId): Promise<VirtualTable | null>;
  findBySession(sessionId: EntityId): Promise<VirtualTable | null>;
  findById(id: EntityId): Promise<VirtualTable | null>;
  open(input: OpenVirtualTableInput): Promise<VirtualTable>;
  setMapFile(
    tableId: EntityId,
    mapFileId: EntityId | null,
  ): Promise<{ table: VirtualTable; previousMapFileId: EntityId | null } | null>;
  listMapsByCampaign(campaignId: EntityId): Promise<VirtualTableMap[]>;
  findMapById(mapId: EntityId): Promise<VirtualTableMap | null>;
  createMap(input: CreateEntityInput<VirtualTableMap>): Promise<VirtualTableMap>;
  activateMap(
    tableId: EntityId,
    mapId: EntityId,
  ): Promise<{ table: VirtualTable; map: VirtualTableMap } | null>;
  advanceChapter(
    input: AdvanceVirtualTableChapterInput,
  ): Promise<{
    table: VirtualTable;
    completedChapter: CampaignChapter;
    nextChapter: CampaignChapter | null;
    map: VirtualTableMap | null;
  } | null>;
  deleteMap(
    mapId: EntityId,
  ): Promise<{ deleted: boolean; fileId: EntityId | null }>;
  listTokens(tableId: EntityId): Promise<VirtualTableToken[]>;
  listTokensByCharacter(characterId: EntityId): Promise<VirtualTableToken[]>;
  findTokenById(tokenId: EntityId): Promise<VirtualTableToken | null>;
  createToken(
    input: CreateEntityInput<VirtualTableToken>,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken }>;
  moveToken(
    tableId: EntityId,
    tokenId: EntityId,
    x: number,
    y: number,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null>;
  setTokenVisibility(
    tableId: EntityId,
    tokenId: EntityId,
    visible: boolean,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null>;
  updateToken(
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
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null>;
  deleteToken(
    tableId: EntityId,
    tokenId: EntityId,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null>;
  listRolls(tableId: EntityId, limit?: number): Promise<DiceRoll[]>;
  createRoll(
    input: CreateEntityInput<DiceRoll>,
  ): Promise<{ table: VirtualTable; roll: DiceRoll }>;
}

export interface RepositoryRegistry {
  users: UserRepository;
  campaigns: CampaignRepository;
  campaignChapters: CampaignChapterRepository;
  campaignMembers: CampaignMemberRepository;
  characters: CharacterRepository;
  characterStatusOptions: CharacterStatusOptionRepository;
  characterClassOptions: CharacterClassOptionRepository;
  teams: TeamRepository;
  teamMembers: TeamMemberRepository;
  missions: MissionRepository;
  missionParticipants: MissionParticipantRepository;
  campaignSessions: CampaignSessionRepository;
  sessionParticipants: SessionParticipantRepository;
  campaignEvents: CampaignEventRepository;
  files: FileRepository;
  fileRelations: FileRelationRepository;
  tabletop: TabletopRepository;
  dashboardSummary: DashboardSummaryRepository;
}
