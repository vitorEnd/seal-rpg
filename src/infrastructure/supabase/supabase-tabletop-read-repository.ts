import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TabletopReadRepository,
  TabletopSnapshot,
} from "@/application/tabletop/tabletop-read-repository";
import type { FileStorageProvider } from "@/application/storage/file-storage-provider";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  mapDiceRollRow,
  mapVirtualTableMapRow,
  mapVirtualTableTokenRow,
} from "@/infrastructure/supabase/supabase-tabletop-repository";

type TimelineRow =
  Database["public"]["Functions"]["get_campaign_chapter_timeline"]["Returns"][number];

function ensureNoError(
  error: { message: string } | null,
  context: string,
): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function timelineChapter(row: TimelineRow | undefined) {
  if (!row || !row.chapter_id) return null;
  return {
    id: row.chapter_id,
    title: row.title,
    order: row.sort_order,
  };
}

export class SupabaseTabletopReadRepository
  implements TabletopReadRepository
{
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly fileStorage: FileStorageProvider,
  ) {}

  async findOpenSnapshotByCampaignSlug(
    slug: string,
    options: {
      includeHiddenTokens: boolean;
      includeLockedChapterDetails?: boolean;
    },
  ): Promise<TabletopSnapshot | null> {
    const campaignResult = await this.client
      .from("campaigns")
      .select(
        "id,name,slug,primary_color,secondary_color,game_master_user_id",
      )
      .eq("slug", slug)
      .maybeSingle();
    ensureNoError(campaignResult.error, "Falha ao carregar a campanha");
    const campaign = campaignResult.data;
    if (!campaign) return null;

    const tableResult = await this.client
      .from("virtual_tables")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    ensureNoError(tableResult.error, "Falha ao carregar a mesa");
    const table = tableResult.data;
    if (!table) return null;

    const [
      sessionResult,
      timelineResult,
      mapsResult,
      tokensResult,
      charactersResult,
      profilesResult,
      membershipsResult,
      rollsResult,
      transitionResult,
    ] = await Promise.all([
      this.client
        .from("campaign_sessions")
        .select("*")
        .eq("id", table.session_id)
        .eq("campaign_id", campaign.id)
        .maybeSingle(),
      this.client.rpc("get_campaign_chapter_timeline", {
        target_campaign_id: campaign.id,
      }),
      this.client
        .from("virtual_table_maps")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("sort_order")
        .order("group_name")
        .order("layer_name"),
      table.active_map_id
        ? this.client
            .from("virtual_table_tokens")
            .select("*")
            .eq("table_id", table.id)
            .eq("map_id", table.active_map_id)
            .order("z_index")
            .order("created_at")
        : this.client
            .from("virtual_table_tokens")
            .select("*")
            .eq("table_id", table.id)
            .is("map_id", null)
            .order("z_index")
            .order("created_at"),
      this.client
        .from("characters")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("name"),
      this.client.rpc("list_campaign_profiles", {
        target_campaign_id: campaign.id,
      }),
      this.client
        .from("campaign_members")
        .select("user_id,role,status")
        .eq("campaign_id", campaign.id)
        .eq("status", "approved"),
      this.client
        .from("dice_rolls")
        .select("*")
        .eq("table_id", table.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(30),
      this.client
        .from("chapter_transitions")
        .select("*")
        .eq("table_id", table.id)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    ensureNoError(sessionResult.error, "Falha ao carregar a sessão");
    ensureNoError(timelineResult.error, "Falha ao carregar os capítulos");
    ensureNoError(mapsResult.error, "Falha ao carregar os mapas");
    ensureNoError(tokensResult.error, "Falha ao carregar os tokens");
    ensureNoError(charactersResult.error, "Falha ao carregar os personagens");
    ensureNoError(profilesResult.error, "Falha ao carregar os jogadores");
    ensureNoError(membershipsResult.error, "Falha ao carregar os membros");
    ensureNoError(rollsResult.error, "Falha ao carregar as rolagens");
    ensureNoError(transitionResult.error, "Falha ao carregar a transição");

    const session = sessionResult.data;
    if (!session) return null;

    const mapRows = mapsResult.data ?? [];
    const tokenRows = tokensResult.data ?? [];
    const characterRows = charactersResult.data ?? [];
    const fileIds = new Set<string>();
    if (table.map_file_id) fileIds.add(table.map_file_id);
    for (const map of mapRows) {
      if (map.image_file_id) fileIds.add(map.image_file_id);
    }
    for (const token of tokenRows) {
      if (token.image_file_id) fileIds.add(token.image_file_id);
    }

    const filesResult = fileIds.size
      ? await this.client
          .from("game_files")
          .select("id,name,storage_key")
          .in("id", [...fileIds])
      : { data: [], error: null };
    ensureNoError(filesResult.error, "Falha ao carregar os arquivos da mesa");
    const filesById = new Map(
      (filesResult.data ?? []).map((file) => [file.id, file]),
    );

    const downloadUrl = async (
      storageKey: string | null,
      fallback: string | null,
    ): Promise<string | null> =>
      storageKey ? this.fileStorage.getDownloadUrl(storageKey) : fallback;

    const maps = await Promise.all(
      mapRows.map(async (row) => {
        const map = mapVirtualTableMapRow(row);
        const file = map.imageFileId ? filesById.get(map.imageFileId) : null;
        return {
          id: map.id,
          name: map.name,
          description: map.description,
          groupName: map.groupName,
          layerName: map.layerName,
          imageUrl: await downloadUrl(
            file?.storage_key ?? null,
            map.builtInImageUrl,
          ),
          scale: map.scale,
          builtIn: map.builtIn,
          order: map.order,
        } satisfies TabletopSnapshot["maps"][number];
      }),
    );

    const activeMap =
      maps.find((map) => map.id === table.active_map_id) ?? maps[0] ?? null;
    const legacyMapFile = table.map_file_id
      ? filesById.get(table.map_file_id) ?? null
      : null;
    const legacyMapUrl = await downloadUrl(
      legacyMapFile?.storage_key ?? null,
      null,
    );

    const characters = await Promise.all(
      characterRows.map(async (row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        coverImageUrl: await downloadUrl(
          row.cover_image_storage_key,
          row.cover_image_url,
        ),
        equipment: row.equipment,
        wounds: row.wounds,
        backpackItems: row.backpack_items,
        inventorySlots: row.inventory_slots,
      })),
    );
    const characterRowsById = new Map(
      characterRows.map((character) => [character.id, character]),
    );
    const characterViewsById = new Map(
      characters.map((character) => [character.id, character]),
    );

    const tokens = await Promise.all(
      tokenRows
        .filter((row) => options.includeHiddenTokens || row.visible)
        .map(async (row) => {
          const token = mapVirtualTableTokenRow(row);
          const character = token.characterId
            ? characterRowsById.get(token.characterId) ?? null
            : null;
          const characterView = token.characterId
            ? characterViewsById.get(token.characterId) ?? null
            : null;
          const file = token.imageFileId
            ? filesById.get(token.imageFileId) ?? null
            : null;
          return {
            id: token.id,
            tableId: token.tableId,
            mapId: token.mapId,
            name: token.name,
            kind: token.kind,
            characterId: token.characterId,
            controllerUserId: character?.user_id ?? null,
            imageUrl: await downloadUrl(
              file?.storage_key ?? null,
              characterView?.coverImageUrl ?? null,
            ),
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
          } satisfies TabletopSnapshot["tokens"][number];
        }),
    );

    const memberships = new Map(
      (membershipsResult.data ?? []).map((membership) => [
        membership.user_id,
        membership,
      ]),
    );
    const players = (profilesResult.data ?? [])
      .filter((profile) => profile.status === "active")
      .map((profile) => {
        const membership = memberships.get(profile.id);
        const role =
          campaign.game_master_user_id === profile.id ||
          membership?.role === "game_master"
            ? "game_master"
            : "player";
        return {
          userId: profile.id,
          name: profile.name,
          username: profile.username,
          avatarUrl: profile.avatar_url,
          role,
          characters: characters
            .filter((character) => character.userId === profile.id)
            .map((character) => ({ id: character.id, name: character.name })),
        } satisfies TabletopSnapshot["players"][number];
      })
      .sort(
        (left, right) =>
          Number(right.role === "game_master") -
            Number(left.role === "game_master") ||
          left.name.localeCompare(right.name),
      );

    const timeline = timelineResult.data ?? [];
    const currentRow = timeline.find((chapter) => chapter.state === "available");
    const nextRow = timeline.find((chapter) => chapter.state === "locked");
    const previousRow = timeline
      .filter((chapter) => chapter.state === "completed")
      .at(-1);
    const chaptersById = new Map(
      timeline
        .filter((chapter) => chapter.chapter_id)
        .map((chapter) => [chapter.chapter_id, chapter]),
    );
    const storedTransition = transitionResult.data;
    const fromRow = storedTransition
      ? chaptersById.get(storedTransition.from_chapter_id)
      : undefined;
    const toRow = storedTransition?.to_chapter_id
      ? chaptersById.get(storedTransition.to_chapter_id)
      : undefined;
    const transitionMap = storedTransition?.map_id
      ? maps.find((map) => map.id === storedTransition.map_id) ?? null
      : null;
    const transition =
      storedTransition && (fromRow || toRow)
        ? {
            id: storedTransition.id,
            // Ao voltar, o capítulo que ficou bloqueado é redigido para jogadores.
            // O destino continua visível e mantém a animação sincronizada para todos.
            from: timelineChapter(fromRow ?? toRow)!,
            to: storedTransition.to_chapter_id
              ? timelineChapter(toRow)
              : null,
            mapName:
              transitionMap?.name ??
              activeMap?.name ??
              legacyMapFile?.name ??
              "Mapa tático atual",
            occurredAt: storedTransition.occurred_at,
          }
        : null;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        primaryColor: campaign.primary_color,
        secondaryColor: campaign.secondary_color,
      },
      session: {
        id: session.id,
        sessionNumber: session.session_number,
        title: session.title,
        status: session.status as TabletopSnapshot["session"]["status"],
      },
      table: {
        id: table.id,
        status: "open",
        revision: table.revision,
        openedAt: table.opened_at,
        activeMapId: activeMap?.id ?? null,
        mapName:
          activeMap?.name ?? legacyMapFile?.name ?? "Mapa tático padrão",
        mapImageUrl:
          activeMap?.imageUrl ??
          legacyMapUrl ??
          (campaign.slug === "operacao-neptune"
            ? "/art/maps/neptune-cargo-ship-main-deck.png"
            : null),
      },
      chapterProgress: {
        previous: timelineChapter(previousRow),
        current: timelineChapter(currentRow),
        next: options.includeLockedChapterDetails
          ? timelineChapter(nextRow)
          : null,
        hasNext: Boolean(nextRow),
        completedCount: timeline.filter((chapter) => chapter.state === "completed")
          .length,
        total: timeline.length,
        transition,
      },
      tokens,
      maps,
      characters,
      players,
      rolls: (rollsResult.data ?? []).map(mapDiceRollRow),
    };
  }
}
