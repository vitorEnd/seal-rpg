import type {
  DiceRoll,
  EntityId,
  VirtualTableMapScale,
  VirtualTableTokenDisposition,
  VirtualTableTokenKind,
} from "@/domain/entities";

export interface TabletopCampaignView {
  id: EntityId;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface TabletopSessionView {
  id: EntityId;
  sessionNumber: number;
  title: string;
  status: "scheduled" | "completed" | "cancelled";
}

export interface TabletopChapterView {
  id: EntityId;
  title: string;
  order: number;
}

export interface TabletopChapterTransitionView {
  id: EntityId;
  from: TabletopChapterView;
  to: TabletopChapterView | null;
  mapName: string;
  occurredAt: string;
}

export interface TabletopTokenView {
  id: EntityId;
  tableId: EntityId;
  mapId: EntityId | null;
  name: string;
  kind: VirtualTableTokenKind;
  characterId: EntityId | null;
  controllerUserId: EntityId | null;
  imageUrl: string | null;
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
  updatedAt: string;
}

export interface TabletopMapView {
  id: EntityId;
  name: string;
  description: string;
  groupName: string;
  layerName: string;
  imageUrl: string | null;
  scale: VirtualTableMapScale;
  builtIn: boolean;
  order: number;
}

export interface TabletopCharacterView {
  id: EntityId;
  userId: EntityId;
  name: string;
  coverImageUrl: string | null;
  equipment: string[];
  wounds: string[];
  backpackItems: string[];
  inventorySlots: number;
}

export interface TabletopPlayerView {
  userId: EntityId;
  name: string;
  username: string;
  avatarUrl: string | null;
  role: "game_master" | "player";
  characters: Array<{ id: EntityId; name: string }>;
}

export interface TabletopSnapshot {
  campaign: TabletopCampaignView;
  session: TabletopSessionView;
  table: {
    id: EntityId;
    status: "open";
    revision: number;
    openedAt: string;
    activeMapId: EntityId | null;
    mapName: string;
    mapImageUrl: string | null;
  };
  chapterProgress: {
    previous: TabletopChapterView | null;
    current: TabletopChapterView | null;
    next: TabletopChapterView | null;
    hasNext: boolean;
    completedCount: number;
    total: number;
    transition: TabletopChapterTransitionView | null;
  };
  tokens: TabletopTokenView[];
  maps: TabletopMapView[];
  characters: TabletopCharacterView[];
  players: TabletopPlayerView[];
  rolls: DiceRoll[];
}

export interface TabletopReadRepository {
  findOpenSnapshotByCampaignSlug(
    slug: string,
    options: {
      includeHiddenTokens: boolean;
      includeLockedChapterDetails?: boolean;
    },
  ): Promise<TabletopSnapshot | null>;
}
