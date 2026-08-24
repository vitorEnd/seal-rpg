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
  EntityId,
  FileRelation,
  GameFile,
  ISODateString,
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

export interface LocalCredential {
  userId: EntityId;
  passwordHash: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface LocalAuthSession {
  id: EntityId;
  userId: EntityId;
  tokenHash: string;
  createdAt: ISODateString;
  expiresAt: ISODateString;
}

export interface LocalDatabase {
  schemaVersion: 6;
  users: User[];
  campaigns: Campaign[];
  campaignChapters: CampaignChapter[];
  campaignMembers: CampaignMember[];
  characters: Character[];
  characterStatusOptions: CharacterStatusOption[];
  characterClassOptions: CharacterClassOption[];
  teams: Team[];
  teamMembers: TeamMember[];
  missions: Mission[];
  missionParticipants: MissionParticipant[];
  campaignSessions: CampaignSession[];
  sessionParticipants: SessionParticipant[];
  virtualTables: VirtualTable[];
  virtualTableMaps: VirtualTableMap[];
  virtualTableTokens: VirtualTableToken[];
  diceRolls: DiceRoll[];
  campaignEvents: CampaignEvent[];
  files: GameFile[];
  fileRelations: FileRelation[];
  authCredentials: LocalCredential[];
  authSessions: LocalAuthSession[];
}

export type DomainTableName = Exclude<
  keyof LocalDatabase,
  "schemaVersion" | "authCredentials" | "authSessions"
>;
