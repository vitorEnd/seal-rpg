import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignChapter,
  DiceRoll,
  VirtualTable,
  VirtualTableMap,
  VirtualTableToken,
} from "@/domain/entities";
import {
  RepositoryConflictError,
  type AdvanceVirtualTableChapterInput,
  type CreateEntityInput,
  type OpenVirtualTableInput,
  type TabletopRepository,
} from "@/domain/repositories";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  mapCampaignChapterRow,
  mapVirtualTableRow,
  type TableInsert,
  type TableRow,
  type TableUpdate,
} from "@/infrastructure/supabase/supabase-mappers";

type JsonRecord = Record<string, unknown>;

const DATABASE_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Entre novamente para usar a mesa.",
  ACTIVE_PROFILE_REQUIRED: "Seu perfil precisa estar ativo para usar a mesa.",
  TABLE_ACCESS_DENIED: "Você não tem acesso a esta mesa.",
  TABLE_MANAGEMENT_DENIED: "Somente o mestre pode alterar a mesa.",
  CHAPTER_ADVANCE_DENIED: "Somente o mestre pode avançar o capítulo.",
  TOKEN_CONTROL_DENIED: "Você não controla este token.",
  TABLE_NOT_FOUND: "Mesa não encontrada.",
  TABLE_NOT_OPEN: "Esta mesa não está mais aberta.",
  TOKEN_NOT_FOUND: "Token não encontrado.",
  CAMPAIGN_NOT_FOUND: "Campanha não encontrada.",
  SCHEDULED_SESSION_NOT_FOUND:
    "A sessão escolhida não está agendada nesta campanha.",
  MAP_NOT_IN_CAMPAIGN: "O mapa não pertence a esta campanha.",
  MAP_FILE_NOT_IN_CAMPAIGN: "A imagem do mapa não pertence a esta campanha.",
  BUILT_IN_MAP_DELETE_DENIED:
    "Os mapas internos da campanha não podem ser excluídos.",
  MAP_STILL_HAS_TOKENS:
    "Este mapa ainda possui tokens. Mova-os para outra camada antes de excluir.",
  INVALID_TOKEN_POSITION: "A posição do token é inválida.",
  INVALID_DICE_EXPRESSION: "Use comandos como 1d20, 2d6+3 ou 1d100.",
  NO_CURRENT_CHAPTER: "Todos os capítulos publicados já foram concluídos.",
  CURRENT_CHAPTER_CHANGED:
    "O capítulo da mesa mudou. Atualize a página antes de avançar.",
  NEXT_CHAPTER_CHANGED:
    "A ordem dos capítulos mudou. Atualize a mesa antes de concluir.",
  NEXT_CHAPTER_MAP_REQUIRED:
    "Escolha um mapa da campanha para iniciar o próximo capítulo.",
  FINAL_CHAPTER_DOES_NOT_ACCEPT_MAP:
    "O último capítulo não precisa de um novo mapa.",
  TABLE_STATE_CHANGED: "A mesa mudou. Atualize a página e tente novamente.",
};

export function asJsonRecord(value: unknown, label = "resposta"): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryConflictError(
      "database",
      `O banco retornou uma ${label} inválida.`,
    );
  }
  return value as JsonRecord;
}

function databaseConflict(
  error: { message?: string; details?: string | null; code?: string } | null,
  fallback: string,
): never {
  const source = `${error?.message ?? ""} ${error?.details ?? ""}`;
  const knownCode = Object.keys(DATABASE_ERROR_MESSAGES).find((code) =>
    source.includes(code),
  );
  throw new RepositoryConflictError(
    "database",
    knownCode ? DATABASE_ERROR_MESSAGES[knownCode] : fallback,
  );
}

export function mapVirtualTableMapRow(
  row: TableRow<"virtual_table_maps">,
): VirtualTableMap {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    groupName: row.group_name,
    layerName: row.layer_name,
    imageFileId: row.image_file_id,
    builtInImageUrl: row.built_in_image_url,
    scale: row.scale as VirtualTableMap["scale"],
    builtIn: row.built_in,
    order: row.sort_order,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVirtualTableTokenRow(
  row: TableRow<"virtual_table_tokens">,
): VirtualTableToken {
  return {
    id: row.id,
    tableId: row.table_id,
    mapId: row.map_id,
    name: row.name,
    kind: row.kind as VirtualTableToken["kind"],
    characterId: row.character_id,
    imageFileId: row.image_file_id,
    x: row.x,
    y: row.y,
    size: row.size,
    zIndex: row.z_index,
    visible: row.visible,
    disposition: row.disposition as VirtualTableToken["disposition"],
    accentColor: row.accent_color,
    notes: row.notes,
    collectible: row.collectible,
    rotation: row.rotation,
    visionEnabled: row.vision_enabled,
    visionAngle: row.vision_angle,
    visionRange: row.vision_range,
    visionColor: row.vision_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDiceRollRow(row: TableRow<"dice_rolls">): DiceRoll {
  return {
    id: row.id,
    tableId: row.table_id,
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    userId: row.user_id,
    actorName: row.actor_name,
    expression: row.expression,
    diceValues: row.dice_values,
    modifier: row.modifier,
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowFromJson<T extends keyof Database["public"]["Tables"]>(
  value: unknown,
  label: string,
): TableRow<T> {
  return asJsonRecord(value, label) as TableRow<T>;
}

export class SupabaseTabletopRepository implements TabletopRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findOpenByCampaign(campaignId: string): Promise<VirtualTable | null> {
    const { data, error } = await this.client
      .from("virtual_tables")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível consultar a mesa.");
    return data ? mapVirtualTableRow(data) : null;
  }

  async findBySession(sessionId: string): Promise<VirtualTable | null> {
    const { data, error } = await this.client
      .from("virtual_tables")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível consultar a mesa.");
    return data ? mapVirtualTableRow(data) : null;
  }

  async findById(id: string): Promise<VirtualTable | null> {
    const { data, error } = await this.client
      .from("virtual_tables")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível consultar a mesa.");
    return data ? mapVirtualTableRow(data) : null;
  }

  async open(input: OpenVirtualTableInput): Promise<VirtualTable> {
    const { data, error } = await this.client.rpc("open_virtual_table", {
      target_campaign_id: input.campaignId,
      target_session_id: input.sessionId,
    });
    if (error) databaseConflict(error, "Não foi possível abrir a mesa.");
    const response = asJsonRecord(data, "resposta de abertura");
    return mapVirtualTableRow(
      rowFromJson<"virtual_tables">(response.table, "mesa"),
    );
  }

  async setMapFile(
    tableId: string,
    mapFileId: string | null,
  ): Promise<{ table: VirtualTable; previousMapFileId: string | null } | null> {
    const { data, error } = await this.client.rpc("set_virtual_table_map_file", {
      target_table_id: tableId,
      target_map_file_id: mapFileId as string,
    });
    if (error) {
      if (error.message.includes("TABLE_NOT_OPEN")) return null;
      databaseConflict(error, "Não foi possível trocar o mapa.");
    }
    const response = asJsonRecord(data, "resposta de mapa");
    return {
      table: mapVirtualTableRow(
        rowFromJson<"virtual_tables">(response.table, "mesa"),
      ),
      previousMapFileId:
        typeof response.previousMapFileId === "string"
          ? response.previousMapFileId
          : null,
    };
  }

  async listMapsByCampaign(campaignId: string): Promise<VirtualTableMap[]> {
    const { data, error } = await this.client
      .from("virtual_table_maps")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sort_order")
      .order("group_name")
      .order("layer_name");
    if (error) databaseConflict(error, "Não foi possível carregar os mapas.");
    return (data ?? []).map(mapVirtualTableMapRow);
  }

  async findMapById(mapId: string): Promise<VirtualTableMap | null> {
    const { data, error } = await this.client
      .from("virtual_table_maps")
      .select("*")
      .eq("id", mapId)
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível consultar o mapa.");
    return data ? mapVirtualTableMapRow(data) : null;
  }

  async createMap(
    input: CreateEntityInput<VirtualTableMap>,
  ): Promise<VirtualTableMap> {
    const insert: TableInsert<"virtual_table_maps"> = {
      campaign_id: input.campaignId,
      name: input.name,
      description: input.description,
      group_name: input.groupName,
      layer_name: input.layerName,
      image_file_id: input.imageFileId,
      built_in_image_url: input.builtInImageUrl,
      scale: input.scale,
      built_in: input.builtIn,
      sort_order: input.order,
      created_by_user_id: input.createdByUserId,
    };
    const { data, error } = await this.client
      .from("virtual_table_maps")
      .insert(insert)
      .select("*")
      .single();
    if (error) databaseConflict(error, "Não foi possível criar o mapa.");
    return mapVirtualTableMapRow(data);
  }

  async activateMap(
    tableId: string,
    mapId: string,
  ): Promise<{ table: VirtualTable; map: VirtualTableMap } | null> {
    const { data, error } = await this.client.rpc("activate_virtual_table_map", {
      target_table_id: tableId,
      target_map_id: mapId,
    });
    if (error) {
      if (error.message.includes("TABLE_NOT_OPEN")) return null;
      databaseConflict(error, "Não foi possível ativar o mapa.");
    }
    const response = asJsonRecord(data, "resposta de ativação");
    return {
      table: mapVirtualTableRow(
        rowFromJson<"virtual_tables">(response.table, "mesa"),
      ),
      map: mapVirtualTableMapRow(
        rowFromJson<"virtual_table_maps">(response.map, "mapa"),
      ),
    };
  }

  async advanceChapter(
    input: AdvanceVirtualTableChapterInput,
  ): Promise<{
    table: VirtualTable;
    completedChapter: CampaignChapter;
    nextChapter: CampaignChapter | null;
    map: VirtualTableMap | null;
  } | null> {
    const { data, error } = await this.client.rpc(
      "advance_virtual_table_chapter",
      {
        target_table_id: input.tableId,
        expected_current_chapter_id: input.currentChapterId,
        expected_next_chapter_id: input.nextChapterId as string,
        target_map_id: input.mapId as string,
      },
    );
    if (error) {
      if (error.message.includes("TABLE_NOT_OPEN")) return null;
      databaseConflict(error, "Não foi possível avançar o capítulo.");
    }
    const response = asJsonRecord(data, "resposta de capítulo");
    return {
      table: mapVirtualTableRow(
        rowFromJson<"virtual_tables">(response.table, "mesa"),
      ),
      completedChapter: mapCampaignChapterRow(
        rowFromJson<"campaign_chapters">(
          response.completedChapter,
          "capítulo concluído",
        ),
      ),
      nextChapter: response.nextChapter
        ? mapCampaignChapterRow(
            rowFromJson<"campaign_chapters">(
              response.nextChapter,
              "próximo capítulo",
            ),
          )
        : null,
      map: response.map
        ? mapVirtualTableMapRow(
            rowFromJson<"virtual_table_maps">(response.map, "mapa"),
          )
        : null,
    };
  }

  async deleteMap(
    mapId: string,
  ): Promise<{ deleted: boolean; fileId: string | null }> {
    const { data, error } = await this.client.rpc("delete_virtual_table_map", {
      target_map_id: mapId,
    });
    if (error) databaseConflict(error, "Não foi possível excluir o mapa.");
    const response = asJsonRecord(data, "resposta de exclusão");
    return {
      deleted: response.deleted === true,
      fileId: typeof response.fileId === "string" ? response.fileId : null,
    };
  }

  async listTokens(tableId: string): Promise<VirtualTableToken[]> {
    const { data, error } = await this.client
      .from("virtual_table_tokens")
      .select("*")
      .eq("table_id", tableId)
      .order("z_index")
      .order("created_at");
    if (error) databaseConflict(error, "Não foi possível carregar os tokens.");
    return (data ?? []).map(mapVirtualTableTokenRow);
  }

  async listTokensByCharacter(characterId: string): Promise<VirtualTableToken[]> {
    const { data, error } = await this.client
      .from("virtual_table_tokens")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at");
    if (error) databaseConflict(error, "Não foi possível carregar os tokens.");
    return (data ?? []).map(mapVirtualTableTokenRow);
  }

  async findTokenById(tokenId: string): Promise<VirtualTableToken | null> {
    const { data, error } = await this.client
      .from("virtual_table_tokens")
      .select("*")
      .eq("id", tokenId)
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível consultar o token.");
    return data ? mapVirtualTableTokenRow(data) : null;
  }

  async createToken(
    input: CreateEntityInput<VirtualTableToken>,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken }> {
    const table = await this.findById(input.tableId);
    if (!table || table.status !== "open") {
      throw new RepositoryConflictError("table", "A mesa não está aberta.");
    }
    const insert: TableInsert<"virtual_table_tokens"> = {
      table_id: input.tableId,
      campaign_id: table.campaignId,
      map_id: input.mapId ?? table.activeMapId,
      name: input.name,
      kind: input.kind,
      character_id: input.characterId,
      image_file_id: input.imageFileId,
      x: input.x,
      y: input.y,
      size: input.size,
      z_index: input.zIndex,
      visible: input.visible,
      disposition: input.disposition ?? "neutral",
      accent_color: input.accentColor ?? "#75a9c8",
      notes: input.notes ?? "",
      collectible: input.collectible ?? false,
      rotation: input.rotation ?? 0,
      vision_enabled: input.visionEnabled ?? input.kind !== "object",
      vision_angle: input.visionAngle ?? 70,
      vision_range: input.visionRange ?? 0.22,
      vision_color: input.visionColor ?? input.accentColor ?? "#75a9c8",
    };
    const { data, error } = await this.client
      .from("virtual_table_tokens")
      .insert(insert)
      .select("*")
      .single();
    if (error) databaseConflict(error, "Não foi possível criar o token.");
    const revisedTable = await this.findById(table.id);
    if (!revisedTable) {
      throw new RepositoryConflictError("table", "A mesa não está mais aberta.");
    }
    return { table: revisedTable, token: mapVirtualTableTokenRow(data) };
  }

  async moveToken(
    tableId: string,
    tokenId: string,
    x: number,
    y: number,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    const { data, error } = await this.client.rpc("move_virtual_table_token", {
      target_table_id: tableId,
      target_token_id: tokenId,
      target_x: x,
      target_y: y,
    });
    if (error) {
      if (
        error.message.includes("TABLE_NOT_OPEN") ||
        error.message.includes("TOKEN_NOT_FOUND")
      ) {
        return null;
      }
      databaseConflict(error, "Não foi possível mover o token.");
    }
    const response = asJsonRecord(data, "resposta de movimento");
    return {
      table: mapVirtualTableRow(
        rowFromJson<"virtual_tables">(response.table, "mesa"),
      ),
      token: mapVirtualTableTokenRow(
        rowFromJson<"virtual_table_tokens">(response.token, "token"),
      ),
    };
  }

  async setTokenVisibility(
    tableId: string,
    tokenId: string,
    visible: boolean,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    return this.updateTokenFields(tableId, tokenId, { visible });
  }

  async updateToken(
    tableId: string,
    tokenId: string,
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
    const update: TableUpdate<"virtual_table_tokens"> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.mapId !== undefined) update.map_id = input.mapId;
    if (input.kind !== undefined) update.kind = input.kind;
    if (input.disposition !== undefined) update.disposition = input.disposition;
    if (input.size !== undefined) update.size = input.size;
    if (input.visible !== undefined) update.visible = input.visible;
    if (input.accentColor !== undefined) update.accent_color = input.accentColor;
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.collectible !== undefined) update.collectible = input.collectible;
    if (input.rotation !== undefined) update.rotation = input.rotation;
    if (input.visionEnabled !== undefined) {
      update.vision_enabled = input.visionEnabled;
    }
    if (input.visionAngle !== undefined) update.vision_angle = input.visionAngle;
    if (input.visionRange !== undefined) update.vision_range = input.visionRange;
    if (input.visionColor !== undefined) update.vision_color = input.visionColor;
    return this.updateTokenFields(tableId, tokenId, update);
  }

  private async updateTokenFields(
    tableId: string,
    tokenId: string,
    update: TableUpdate<"virtual_table_tokens">,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    const { data, error } = await this.client
      .from("virtual_table_tokens")
      .update(update)
      .eq("id", tokenId)
      .eq("table_id", tableId)
      .select("*")
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível atualizar o token.");
    if (!data) return null;
    const table = await this.findById(tableId);
    if (!table) return null;
    return { table, token: mapVirtualTableTokenRow(data) };
  }

  async deleteToken(
    tableId: string,
    tokenId: string,
  ): Promise<{ table: VirtualTable; token: VirtualTableToken } | null> {
    const { data, error } = await this.client
      .from("virtual_table_tokens")
      .delete()
      .eq("id", tokenId)
      .eq("table_id", tableId)
      .select("*")
      .maybeSingle();
    if (error) databaseConflict(error, "Não foi possível remover o token.");
    if (!data) return null;
    const table = await this.findById(tableId);
    if (!table) return null;
    return { table, token: mapVirtualTableTokenRow(data) };
  }

  async listRolls(tableId: string, limit = 30): Promise<DiceRoll[]> {
    const { data, error } = await this.client
      .from("dice_rolls")
      .select("*")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.max(0, limit));
    if (error) databaseConflict(error, "Não foi possível carregar as rolagens.");
    return (data ?? []).map(mapDiceRollRow);
  }

  async createRoll(
    input: CreateEntityInput<DiceRoll>,
  ): Promise<{ table: VirtualTable; roll: DiceRoll }> {
    const { data, error } = await this.client.rpc("roll_virtual_table_dice", {
      target_table_id: input.tableId,
      requested_expression: input.expression,
    });
    if (error) databaseConflict(error, "Não foi possível rolar os dados.");
    const response = asJsonRecord(data, "resposta da rolagem");
    return {
      table: mapVirtualTableRow(
        rowFromJson<"virtual_tables">(response.table, "mesa"),
      ),
      roll: mapDiceRollRow(
        rowFromJson<"dice_rolls">(response.roll, "rolagem"),
      ),
    };
  }
}
