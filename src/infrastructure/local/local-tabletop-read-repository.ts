import "server-only";

import type { TabletopReadRepository, TabletopSnapshot } from "@/application/tabletop/tabletop-read-repository";
import type { FileStorageProvider } from "@/application/storage/file-storage-provider";
import { resolveCampaignChapterProgression } from "@/domain/chapter-progression";
import { JsonDatabase } from "@/infrastructure/local/json-database";

function defaultMapUrl(slug: string): string | null {
  return slug === "operacao-neptune"
    ? "/art/maps/neptune-cargo-ship-main-deck.png"
    : null;
}

export class LocalTabletopReadRepository implements TabletopReadRepository {
  constructor(
    private readonly database: JsonDatabase,
    private readonly fileStorage: FileStorageProvider,
  ) {}

  async findOpenSnapshotByCampaignSlug(
    slug: string,
    options: {
      includeHiddenTokens: boolean;
      includeLockedChapterDetails?: boolean;
    },
  ): Promise<TabletopSnapshot | null> {
    const database = await this.database.read();
    const campaign = database.campaigns.find((item) => item.slug === slug);
    if (!campaign) return null;

    const table = database.virtualTables
      .filter((item) => item.campaignId === campaign.id && item.status === "open")
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt))[0];
    if (!table) return null;

    const session = database.campaignSessions.find(
      (item) => item.id === table.sessionId && item.campaignId === campaign.id,
    );
    if (!session) return null;

    const campaignChapters = database.campaignChapters.filter(
      (chapter) => chapter.campaignId === campaign.id,
    );
    const chaptersById = new Map(
      campaignChapters.map((chapter) => [chapter.id, chapter]),
    );
    const chapterProgress = resolveCampaignChapterProgression(campaignChapters);

    const filesById = new Map(database.files.map((file) => [file.id, file]));
    const characters = database.characters
      .filter((character) => character.campaignId === campaign.id)
      .sort((left, right) => left.name.localeCompare(right.name));
    const charactersById = new Map(
      characters.map((character) => [character.id, character]),
    );
    const campaignMaps = database.virtualTableMaps
      .filter((map) => map.campaignId === campaign.id)
      .sort(
        (left, right) =>
          left.order - right.order || left.name.localeCompare(right.name),
      );
    const activeMapRecord =
      campaignMaps.find((map) => map.id === table.activeMapId) ??
      (table.mapFileId ? null : campaignMaps[0] ?? null);
    const effectiveActiveMapId = activeMapRecord?.id ?? null;

    const tableTokens = database.virtualTableTokens
      .filter(
        (token) =>
          token.tableId === table.id &&
          token.mapId === effectiveActiveMapId &&
          (options.includeHiddenTokens || token.visible),
      )
      .sort(
        (left, right) =>
          left.zIndex - right.zIndex || left.createdAt.localeCompare(right.createdAt),
      );

    const tokens = await Promise.all(
      tableTokens.map(async (token) => {
        const character = token.characterId
          ? charactersById.get(token.characterId) ?? null
          : null;
        const imageFile = token.imageFileId
          ? filesById.get(token.imageFileId) ?? null
          : null;
        const imageUrl = imageFile?.storageKey
          ? await this.fileStorage.getDownloadUrl(imageFile.storageKey)
          : character?.coverImageUrl ?? null;

        return {
          id: token.id,
          tableId: token.tableId,
          mapId: token.mapId,
          name: token.name,
          kind: token.kind,
          characterId: token.characterId,
          controllerUserId: character?.userId ?? null,
          imageUrl,
          x: token.x,
          y: token.y,
          size: token.size,
          zIndex: token.zIndex,
          visible: token.visible,
          disposition: token.disposition,
          accentColor: token.accentColor,
          notes: token.notes,
          collectible: token.collectible,
          rotation: token.rotation,
          visionEnabled: token.visionEnabled,
          visionAngle: token.visionAngle,
          visionRange: token.visionRange,
          visionColor: token.visionColor,
          updatedAt: token.updatedAt,
        };
      }),
    );

    const approvedMemberships = database.campaignMembers.filter(
      (membership) =>
        membership.campaignId === campaign.id && membership.status === "approved",
    );
    const usersById = new Map(database.users.map((user) => [user.id, user]));
    const playerIds = new Set(approvedMemberships.map((item) => item.userId));
    if (campaign.gameMasterUserId) playerIds.add(campaign.gameMasterUserId);

    const players = [...playerIds]
      .flatMap((userId) => {
        const user = usersById.get(userId);
        if (!user || user.status !== "active") return [];
        const membership = approvedMemberships.find((item) => item.userId === userId);
        const role =
          campaign.gameMasterUserId === userId || membership?.role === "game_master"
            ? "game_master"
            : "player";
        return [
          {
            userId: user.id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
            role,
            characters: characters
              .filter((character) => character.userId === user.id)
              .map((character) => ({ id: character.id, name: character.name })),
          } satisfies TabletopSnapshot["players"][number],
        ];
      })
      .sort(
        (left, right) =>
          Number(right.role === "game_master") - Number(left.role === "game_master") ||
          left.name.localeCompare(right.name),
      );

    const maps = await Promise.all(
      campaignMaps
        .map(async (map) => {
          const imageFile = map.imageFileId
            ? filesById.get(map.imageFileId) ?? null
            : null;
          const imageUrl = imageFile?.storageKey
            ? await this.fileStorage.getDownloadUrl(imageFile.storageKey)
            : map.builtInImageUrl;
          return {
            id: map.id,
            name: map.name,
            description: map.description,
            groupName: map.groupName,
            layerName: map.layerName,
            imageUrl,
            scale: map.scale,
            builtIn: map.builtIn,
            order: map.order,
          } satisfies TabletopSnapshot["maps"][number];
        }),
    );
    const activeMap =
      maps.find((map) => map.id === table.activeMapId) ??
      (table.mapFileId ? null : maps[0] ?? null);
    const legacyMapFile = table.mapFileId
      ? filesById.get(table.mapFileId) ?? null
      : null;
    const legacyMapImageUrl = legacyMapFile?.storageKey
      ? await this.fileStorage.getDownloadUrl(legacyMapFile.storageKey)
      : null;
    const mapImageUrl =
      activeMap?.imageUrl ?? legacyMapImageUrl ?? defaultMapUrl(campaign.slug);
    const storedTransition = table.lastChapterTransition;
    const transitionFrom = storedTransition
      ? chaptersById.get(storedTransition.fromChapterId) ?? null
      : null;
    const transitionTo = storedTransition?.toChapterId
      ? chaptersById.get(storedTransition.toChapterId) ?? null
      : null;
    const transitionMap = storedTransition?.mapId
      ? maps.find((map) => map.id === storedTransition.mapId) ?? null
      : null;
    const chapterTransition =
      storedTransition &&
      transitionFrom &&
      (storedTransition.toChapterId === null || transitionTo)
        ? {
            id: storedTransition.id,
            from: {
              id: transitionFrom.id,
              title: transitionFrom.title,
              order: transitionFrom.order,
            },
            to: transitionTo
              ? {
                  id: transitionTo.id,
                  title: transitionTo.title,
                  order: transitionTo.order,
                }
              : null,
            mapName:
              transitionMap?.name ??
              activeMap?.name ??
              legacyMapFile?.name ??
              "Mapa tático atual",
            occurredAt: storedTransition.occurredAt,
          }
        : null;

    return structuredClone({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        primaryColor: campaign.primaryColor,
        secondaryColor: campaign.secondaryColor,
      },
      session: {
        id: session.id,
        sessionNumber: session.sessionNumber,
        title: session.title,
        status: session.status,
      },
      table: {
        id: table.id,
        status: "open",
        revision: table.revision,
        openedAt: table.openedAt,
        activeMapId: activeMap?.id ?? null,
        mapName:
          activeMap?.name ?? legacyMapFile?.name ?? "Mapa tático padrão",
        mapImageUrl,
      },
      chapterProgress: {
        current: chapterProgress.currentChapter
          ? {
              id: chapterProgress.currentChapter.id,
              title: chapterProgress.currentChapter.title,
              order: chapterProgress.currentChapter.order,
            }
          : null,
        next:
          options.includeLockedChapterDetails && chapterProgress.nextChapter
          ? {
              id: chapterProgress.nextChapter.id,
              title: chapterProgress.nextChapter.title,
              order: chapterProgress.nextChapter.order,
          }
          : null,
        hasNext: chapterProgress.nextChapter !== null,
        completedCount: chapterProgress.completedCount,
        total: chapterProgress.entries.length,
        transition: chapterTransition,
      },
      tokens,
      maps,
      characters: characters.map((character) => ({
        id: character.id,
        userId: character.userId,
        name: character.name,
        coverImageUrl: character.coverImageUrl,
        equipment: character.equipment,
        wounds: character.wounds,
        backpackItems: character.backpackItems,
        inventorySlots: character.inventorySlots,
      })),
      players,
      rolls: database.diceRolls
        .filter((roll) => roll.tableId === table.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 30),
    } satisfies TabletopSnapshot);
  }
}
