"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseDiceExpression, rollParsedDice } from "@/domain/dice";
import type { Campaign, DiceRoll, GameFile } from "@/domain/entities";
import {
  canControlVirtualTableToken,
  canManageCampaign,
  canViewCampaign,
} from "@/domain/permissions";
import { RepositoryConflictError } from "@/domain/repositories";
import { InvalidStoredFileError } from "@/application/storage/file-storage-provider";
import { getCurrentSession } from "@/lib/auth/current-user";
import { fileStorageProvider, repositories } from "@/lib/container";
import { removeTabletopFiles } from "@/lib/tabletop-files";

const slugSchema = z.string().trim().min(2).max(72).regex(/^[a-z0-9-]+$/);
const idSchema = z.string().uuid();
const colorSchema = z.string().trim().regex(/^#[0-9a-f]{6}$/i);
const tokenKindSchema = z.enum(["character", "npc", "enemy", "object"]);
const dispositionSchema = z.enum([
  "player",
  "ally",
  "neutral",
  "hostile",
  "object",
]);
const moveTokenSchema = z.object({
  campaignSlug: slugSchema,
  tableId: idSchema,
  tokenId: idSchema,
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});
const tokenCommandSchema = z.object({
  campaignSlug: slugSchema,
  tableId: idSchema,
  tokenId: idSchema,
});
const visibilityCommandSchema = tokenCommandSchema.extend({
  visible: z.boolean(),
});
const rollSchema = z.object({
  campaignSlug: slugSchema,
  tableId: idSchema,
  expression: z.string().trim().min(2).max(20),
});
const advanceChapterSchema = z.object({
  campaignSlug: slugSchema,
  tableId: idSchema,
  currentChapterId: idSchema,
  nextChapterId: idSchema.nullable(),
  mapId: idSchema.nullable(),
});
const updateTokenSchema = tokenCommandSchema.extend({
  mapId: idSchema.optional(),
  name: z.string().trim().min(2).max(80),
  kind: tokenKindSchema,
  disposition: dispositionSchema,
  size: z.number().finite().min(0.01).max(0.12),
  visible: z.boolean(),
  accentColor: colorSchema,
  notes: z.string().trim().max(1200),
  collectible: z.boolean(),
  rotation: z.number().finite().min(0).max(359),
  visionEnabled: z.boolean(),
  visionAngle: z.number().finite().min(10).max(180),
  visionRange: z.number().finite().min(0.05).max(0.6),
  visionColor: colorSchema,
});
const loadoutSchema = z.object({
  campaignSlug: slugSchema,
  tableId: idSchema,
  characterId: idSchema,
  equipment: z.array(z.string().trim().min(1).max(120)).max(30),
  wounds: z.array(z.string().trim().min(1).max(180)).max(30),
  backpackItems: z.array(z.string().trim().min(1).max(120)).max(40),
  inventorySlots: z.number().int().min(1).max(40),
});

export interface TabletopCommandResult {
  ok: boolean;
  message: string;
  revision?: number;
  roll?: DiceRoll;
}

class TabletopActionError extends Error {}

function commandError(error: unknown): TabletopCommandResult {
  if (
    error instanceof TabletopActionError ||
    error instanceof RepositoryConflictError ||
    error instanceof InvalidStoredFileError
  ) {
    return { ok: false, message: error.message };
  }
  console.error("Falha na mesa virtual:", error);
  return { ok: false, message: "Não foi possível atualizar a mesa agora." };
}

async function campaignContext(campaignSlug: string) {
  const parsedSlug = slugSchema.safeParse(campaignSlug);
  if (!parsedSlug.success) throw new TabletopActionError("Campanha inválida.");

  const authSession = await getCurrentSession();
  if (!authSession) throw new TabletopActionError("Entre novamente para usar a mesa.");

  const campaign = await repositories.campaigns.findBySlug(parsedSlug.data);
  if (!campaign) throw new TabletopActionError("Campanha não encontrada.");
  const membership = await repositories.campaignMembers.findMembership(
    campaign.id,
    authSession.user.id,
  );
  if (!canViewCampaign(authSession.user, campaign, membership)) {
    throw new TabletopActionError("Você não tem acesso a esta mesa.");
  }

  return {
    authSession,
    campaign,
    membership,
    canManage: canManageCampaign(authSession.user, campaign, membership),
  };
}

async function openTableContext(campaignSlug: string, tableId: string) {
  const context = await campaignContext(campaignSlug);
  const table = await repositories.tabletop.findOpenByCampaign(context.campaign.id);
  if (!table || table.id !== tableId) {
    throw new TabletopActionError("Esta mesa não está mais aberta.");
  }
  const campaignSession = await repositories.campaignSessions.findById(table.sessionId);
  if (!campaignSession || campaignSession.campaignId !== context.campaign.id) {
    throw new TabletopActionError("Sessão não encontrada.");
  }
  return { ...context, table, campaignSession };
}

function requireGameMaster(canManage: boolean): void {
  if (!canManage) {
    throw new TabletopActionError("Somente o mestre pode realizar esta ação.");
  }
}

function refreshTablePages(campaign: Campaign): void {
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath(`/campaigns/${campaign.slug}/sessions`);
  revalidatePath(`/campaigns/${campaign.slug}/table`);
  revalidatePath("/admin");
}

function formFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function storeTableImage({
  file,
  campaign,
  sessionId,
  createdByUserId,
  name,
  category,
}: {
  file: File;
  campaign: Campaign;
  sessionId: string;
  createdByUserId: string;
  name: string;
  category: "map" | "image";
}): Promise<GameFile> {
  const stored = await fileStorageProvider.store({
    campaignId: campaign.id,
    originalName: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  let gameFile: GameFile | null = null;
  try {
    gameFile = await repositories.files.create({
      campaignId: campaign.id,
      createdByUserId,
      name,
      description: `Imagem usada na mesa da sessão ${sessionId}.`,
      category,
      visibility: "members",
      storageKey: stored.key,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
    });
    await repositories.fileRelations.create({
      fileId: gameFile.id,
      relationType: "session",
      relationId: sessionId,
    });
    return gameFile;
  } catch (error) {
    if (gameFile) await repositories.files.delete(gameFile.id);
    await fileStorageProvider.remove(stored.key);
    throw error;
  }
}

async function cleanupFailedTableImage(file: GameFile): Promise<void> {
  await removeTabletopFiles([file.id]);
  if (!file.storageKey) return;
  try {
    await fileStorageProvider.remove(file.storageKey);
  } catch (error) {
    console.warn("Não foi possível limpar um upload incompleto da mesa.", error);
  }
}

export async function openVirtualTableAction(
  campaignSlug: string,
  requestedSessionId?: string,
): Promise<TabletopCommandResult> {
  try {
    const context = await campaignContext(campaignSlug);
    requireGameMaster(context.canManage);

    const current = await repositories.tabletop.findOpenByCampaign(context.campaign.id);
    if (current) {
      return {
        ok: true,
        message: "A mesa já está aberta.",
        revision: current.revision,
      };
    }

    const sessions = await repositories.campaignSessions.listByCampaign(
      context.campaign.id,
    );
    const requestedId = requestedSessionId
      ? idSchema.safeParse(requestedSessionId)
      : null;
    if (requestedId && !requestedId.success) {
      throw new TabletopActionError("Sessão inválida.");
    }
    const scheduledSessions = sessions
      .filter((session) => session.status === "scheduled")
      .sort(
        (left, right) =>
          (left.scheduledAt ?? left.createdAt).localeCompare(
            right.scheduledAt ?? right.createdAt,
          ) || left.sessionNumber - right.sessionNumber,
      );
    const scheduled = requestedId?.success
      ? scheduledSessions.find((session) => session.id === requestedId.data)
      : scheduledSessions[0];
    if (requestedId?.success && !scheduled) {
      throw new TabletopActionError(
        "A sessão escolhida não está agendada nesta campanha.",
      );
    }
    const nextSessionNumber =
      sessions.reduce(
        (highest, session) => Math.max(highest, session.sessionNumber),
        0,
      ) + 1;
    const campaignSession =
      scheduled ??
      (await repositories.campaignSessions.create({
        campaignId: context.campaign.id,
        sessionNumber: nextSessionNumber,
        title: `Sessão ${String(nextSessionNumber).padStart(2, "0")}`,
        status: "scheduled",
        scheduledAt: new Date().toISOString(),
        occurredAt: null,
        summary: "",
        description: "",
        events: "",
        consequences: "",
      }));

    const table = await repositories.tabletop.open({
      campaignId: context.campaign.id,
      sessionId: campaignSession.id,
      openedByUserId: context.authSession.user.id,
    });
    refreshTablePages(context.campaign);
    return {
      ok: true,
      message: `Mesa da sessão ${campaignSession.sessionNumber} aberta.`,
      revision: table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function closeVirtualTableAction(input: {
  campaignSlug: string;
  tableId: string;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = z
      .object({ campaignSlug: slugSchema, tableId: idSchema })
      .safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Mesa inválida.");
    const context = await campaignContext(parsed.data.campaignSlug);
    requireGameMaster(context.canManage);
    const requestedTable = await repositories.tabletop.findById(parsed.data.tableId);
    if (!requestedTable || requestedTable.campaignId !== context.campaign.id) {
      throw new TabletopActionError("Mesa não encontrada.");
    }
    const lifecycle = await repositories.campaignSessions.completeTableSession(
      requestedTable.id,
      new Date().toISOString(),
    );
    if (!lifecycle || lifecycle.table.id !== requestedTable.id) {
      throw new TabletopActionError("Mesa não encontrada.");
    }
    refreshTablePages(context.campaign);
    return {
      ok: true,
      message: "Sessão encerrada e enviada para o histórico.",
      revision: lifecycle.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function moveVirtualTableTokenAction(input: {
  campaignSlug: string;
  tableId: string;
  tokenId: string;
  x: number;
  y: number;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = moveTokenSchema.safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Posição inválida.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    const token = await repositories.tabletop.findTokenById(parsed.data.tokenId);
    if (!token || token.tableId !== context.table.id) {
      throw new TabletopActionError("Token não encontrado.");
    }
    const character = token.characterId
      ? await repositories.characters.findById(token.characterId)
      : null;
    if (
      !canControlVirtualTableToken(
        context.authSession.user,
        context.campaign,
        context.membership,
        token,
        character,
      )
    ) {
      throw new TabletopActionError("Você não controla este token.");
    }
    const result = await repositories.tabletop.moveToken(
      context.table.id,
      token.id,
      parsed.data.x,
      parsed.data.y,
    );
    if (!result) throw new TabletopActionError("Token não encontrado.");
    return { ok: true, message: "Posição sincronizada.", revision: result.table.revision };
  } catch (error) {
    return commandError(error);
  }
}

export async function createVirtualTableTokenAction(
  formData: FormData,
): Promise<TabletopCommandResult> {
  const imageFile = formFile(formData, "image");
  let storedImage: GameFile | null = null;
  try {
    const parsed = z
      .object({
        campaignSlug: slugSchema,
        tableId: idSchema,
        kind: tokenKindSchema,
        name: z.string().trim().max(80),
        characterId: z.union([idSchema, z.literal("")]),
        quantity: z.coerce.number().int().min(1).max(20),
        size: z.coerce.number().finite().min(0.01).max(0.12),
        visible: z.boolean(),
        disposition: dispositionSchema.optional(),
        accentColor: colorSchema.optional(),
        notes: z.string().trim().max(1200),
        collectible: z.boolean(),
        rotation: z.coerce.number().finite().min(0).max(359),
        visionEnabled: z.boolean(),
        visionAngle: z.coerce.number().finite().min(10).max(180),
        visionRange: z.coerce.number().finite().min(0.05).max(0.6),
        visionColor: colorSchema.optional(),
      })
      .safeParse({
        campaignSlug: formData.get("campaignSlug"),
        tableId: formData.get("tableId"),
        kind: formData.get("kind"),
        name: formData.get("name") ?? "",
        characterId: formData.get("characterId") ?? "",
        quantity: formData.get("quantity") || 1,
        size: formData.get("size") ?? 0.055,
        visible: formData.get("visible") === "on",
        disposition: formData.get("disposition") || undefined,
        accentColor: formData.get("accentColor") || undefined,
        notes: formData.get("notes") ?? "",
        collectible: formData.get("collectible") === "on",
        rotation: formData.get("rotation") || 0,
        visionEnabled:
          formData.has("visionEnabled")
            ? formData.get("visionEnabled") === "on"
            : formData.get("kind") !== "object",
        visionAngle: formData.get("visionAngle") || 70,
        visionRange: formData.get("visionRange") || 0.22,
        visionColor: formData.get("visionColor") || undefined,
      });
    if (!parsed.success) {
      throw new TabletopActionError(
        "Revise o nome, o tipo, a quantidade e o tamanho do token.",
      );
    }
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);

    const character = parsed.data.characterId
      ? await repositories.characters.findById(parsed.data.characterId)
      : null;
    if (
      parsed.data.characterId &&
      (!character || character.campaignId !== context.campaign.id)
    ) {
      throw new TabletopActionError("Personagem não encontrado nesta campanha.");
    }
    if (parsed.data.kind === "character" && !character) {
      throw new TabletopActionError("Selecione o personagem deste token.");
    }
    if (character && parsed.data.quantity > 1) {
      throw new TabletopActionError(
        "Fichas de jogadores permitem somente um token por mesa.",
      );
    }
    const name = parsed.data.name || character?.name || "Token sem nome";
    if (name.length < 2) throw new TabletopActionError("Informe o nome do token.");

    if (imageFile) {
      storedImage = await storeTableImage({
        file: imageFile,
        campaign: context.campaign,
        sessionId: context.campaignSession.id,
        createdByUserId: context.authSession.user.id,
        name: `Token — ${name}`,
        category: "image",
      });
    }
    const existingTokens = await repositories.tabletop.listTokens(context.table.id);
    const effectiveKind = character ? "character" : parsed.data.kind;
    const defaultDisposition =
      effectiveKind === "character"
        ? "player"
        : effectiveKind === "enemy"
          ? "hostile"
          : effectiveKind === "object"
            ? "object"
            : "ally";
    const defaultAccentColor =
      effectiveKind === "enemy"
        ? "#d45a4f"
        : effectiveKind === "object"
          ? "#d6a45d"
          : "#5ea7a0";
    const highestZIndex = existingTokens.reduce(
      (highest, token) => Math.max(highest, token.zIndex),
      0,
    );
    const result = await repositories.tabletop.createTokens(
      Array.from({ length: parsed.data.quantity }, (_, index) => {
        const slot = (existingTokens.length + index) % 20;
        const copySuffix = ` ${String(index + 1).padStart(2, "0")}`;
        return {
          tableId: context.table.id,
          mapId: context.table.activeMapId,
          name:
            parsed.data.quantity === 1
              ? name
              : `${name.slice(0, 80 - copySuffix.length).trimEnd()}${copySuffix}`,
          kind: effectiveKind,
          characterId: character?.id ?? null,
          imageFileId: storedImage?.id ?? null,
          x: 0.34 + (slot % 5) * 0.07,
          y: 0.42 + Math.floor(slot / 5) * 0.08,
          size: parsed.data.size,
          zIndex: highestZIndex + index + 1,
          visible: parsed.data.visible,
          disposition: parsed.data.disposition ?? defaultDisposition,
          accentColor: parsed.data.accentColor ?? defaultAccentColor,
          notes: parsed.data.notes,
          collectible: parsed.data.collectible,
          rotation: parsed.data.rotation,
          visionEnabled: parsed.data.visionEnabled,
          visionAngle: parsed.data.visionAngle,
          visionRange: parsed.data.visionRange,
          visionColor:
            parsed.data.visionColor ??
            parsed.data.accentColor ??
            defaultAccentColor,
        };
      }),
    );
    return {
      ok: true,
      message:
        parsed.data.quantity === 1
          ? `${name} foi adicionado à mesa.`
          : `${parsed.data.quantity} cópias de ${name} foram adicionadas à mesa.`,
      revision: result.table.revision,
    };
  } catch (error) {
    if (storedImage) {
      const parsedTableId = idSchema.safeParse(formData.get("tableId"));
      let imageStillInUse = true;
      if (parsedTableId.success) {
        try {
          imageStillInUse = (
            await repositories.tabletop.listTokens(parsedTableId.data)
          ).some((token) => token.imageFileId === storedImage?.id);
        } catch (lookupError) {
          console.warn(
            "Não foi possível confirmar se a imagem do lote ainda está em uso.",
            lookupError,
          );
        }
      }
      if (!imageStillInUse) await cleanupFailedTableImage(storedImage);
    }
    return commandError(error);
  }
}

export async function toggleVirtualTableTokenAction(input: {
  campaignSlug: string;
  tableId: string;
  tokenId: string;
  visible: boolean;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = visibilityCommandSchema.safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Token inválido.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const result = await repositories.tabletop.setTokenVisibility(
      context.table.id,
      parsed.data.tokenId,
      parsed.data.visible,
    );
    if (!result) throw new TabletopActionError("Token não encontrado.");
    return {
      ok: true,
      message: result.token.visible
        ? "Token revelado."
        : "Token ocultado dos jogadores.",
      revision: result.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export type UpdateVirtualTableTokenInput = z.infer<typeof updateTokenSchema>;

export async function updateVirtualTableTokenAction(
  input: UpdateVirtualTableTokenInput,
): Promise<TabletopCommandResult> {
  try {
    const parsed = updateTokenSchema.safeParse(input);
    if (!parsed.success) {
      throw new TabletopActionError("Revise as opções de personalização do token.");
    }
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const token = await repositories.tabletop.findTokenById(parsed.data.tokenId);
    if (!token || token.tableId !== context.table.id) {
      throw new TabletopActionError("Token não encontrado.");
    }
    const result = await repositories.tabletop.updateToken(
      context.table.id,
      token.id,
      {
        ...(parsed.data.mapId ? { mapId: parsed.data.mapId } : {}),
        name: parsed.data.name,
        kind: parsed.data.kind,
        disposition: parsed.data.disposition,
        size: parsed.data.size,
        visible: parsed.data.visible,
        accentColor: parsed.data.accentColor,
        notes: parsed.data.notes,
        collectible: parsed.data.collectible,
        rotation: parsed.data.rotation,
        visionEnabled: parsed.data.visionEnabled,
        visionAngle: parsed.data.visionAngle,
        visionRange: parsed.data.visionRange,
        visionColor: parsed.data.visionColor,
      },
    );
    if (!result) throw new TabletopActionError("Token não encontrado.");
    return {
      ok: true,
      message: `${result.token.name} foi personalizado.`,
      revision: result.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function deleteVirtualTableTokenAction(input: {
  campaignSlug: string;
  tableId: string;
  tokenId: string;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = tokenCommandSchema.safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Token inválido.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const result = await repositories.tabletop.deleteToken(
      context.table.id,
      parsed.data.tokenId,
    );
    if (!result) throw new TabletopActionError("Token não encontrado.");
    const imageStillInUse = result.token.imageFileId
      ? (await repositories.tabletop.listTokens(context.table.id)).some(
          (token) => token.imageFileId === result.token.imageFileId,
        )
      : false;
    if (!imageStillInUse) {
      await removeTabletopFiles([result.token.imageFileId]);
    }
    return {
      ok: true,
      message: `${result.token.name} foi removido da mesa.`,
      revision: result.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function updateVirtualTableMapAction(
  formData: FormData,
): Promise<TabletopCommandResult> {
  const mapFile = formFile(formData, "map");
  let storedMap: GameFile | null = null;
  let createdMapId: string | null = null;
  try {
    const parsed = z
      .object({
        campaignSlug: slugSchema,
        tableId: idSchema,
        name: z.string().trim().max(100),
        groupName: z.string().trim().max(100),
        layerName: z.string().trim().max(100),
        scale: z.enum(["medium", "large", "huge"]),
      })
      .safeParse({
        campaignSlug: formData.get("campaignSlug"),
        tableId: formData.get("tableId"),
        name: formData.get("name") ?? "",
        groupName: formData.get("groupName") ?? "",
        layerName: formData.get("layerName") ?? "",
        scale: formData.get("scale") || "large",
      });
    if (!parsed.success) throw new TabletopActionError("Mesa inválida.");
    if (!mapFile) throw new TabletopActionError("Escolha uma imagem para o mapa.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);

    storedMap = await storeTableImage({
      file: mapFile,
      campaign: context.campaign,
      sessionId: context.campaignSession.id,
      createdByUserId: context.authSession.user.id,
      name: `Mapa — ${mapFile.name}`,
      category: "map",
    });
    const maps = await repositories.tabletop.listMapsByCampaign(
      context.campaign.id,
    );
    const map = await repositories.tabletop.createMap({
      campaignId: context.campaign.id,
      name: parsed.data.name || mapFile.name.replace(/\.[^.]+$/, ""),
      description: "Mapa personalizado armazenado na biblioteca da campanha.",
      groupName: parsed.data.groupName || "Mapas personalizados",
      layerName: parsed.data.layerName || "Camada principal",
      imageFileId: storedMap.id,
      builtInImageUrl: null,
      scale: parsed.data.scale,
      builtIn: false,
      order: maps.reduce((highest, item) => Math.max(highest, item.order), 0) + 1,
      createdByUserId: context.authSession.user.id,
    });
    createdMapId = map.id;
    const result = await repositories.tabletop.activateMap(
      context.table.id,
      map.id,
    );
    if (!result) throw new TabletopActionError("A mesa não está mais aberta.");
    storedMap = null;
    createdMapId = null;
    return {
      ok: true,
      message: "Mapa adicionado à biblioteca e transmitido para todos.",
      revision: result.table.revision,
    };
  } catch (error) {
    if (createdMapId) {
      try {
        await repositories.tabletop.deleteMap(createdMapId);
      } catch {
        // A limpeza do arquivo abaixo ainda evita deixar o upload órfão.
      }
    }
    if (storedMap) await cleanupFailedTableImage(storedMap);
    return commandError(error);
  }
}

export async function activateVirtualTableMapAction(input: {
  campaignSlug: string;
  tableId: string;
  mapId: string;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = z
      .object({ campaignSlug: slugSchema, tableId: idSchema, mapId: idSchema })
      .safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Mapa inválido.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const result = await repositories.tabletop.activateMap(
      context.table.id,
      parsed.data.mapId,
    );
    if (!result) throw new TabletopActionError("A mesa não está mais aberta.");
    return {
      ok: true,
      message: `${result.map.name} está ativo para todos.`,
      revision: result.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function advanceVirtualTableChapterAction(input: {
  campaignSlug: string;
  tableId: string;
  currentChapterId: string;
  nextChapterId: string | null;
  mapId: string | null;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = advanceChapterSchema.safeParse(input);
    if (!parsed.success) {
      throw new TabletopActionError("Capítulo ou mapa inválido.");
    }
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const result = await repositories.tabletop.advanceChapter({
      tableId: context.table.id,
      currentChapterId: parsed.data.currentChapterId,
      nextChapterId: parsed.data.nextChapterId,
      mapId: parsed.data.mapId,
      requestedByUserId: context.authSession.user.id,
      completedAt: new Date().toISOString(),
    });
    if (!result) {
      throw new TabletopActionError("A mesa não está mais aberta.");
    }
    refreshTablePages(context.campaign);
    return {
      ok: true,
      message:
        result.nextChapter && result.map
          ? `${result.completedChapter.title} concluído. ${result.nextChapter.title} começou em ${result.map.name}.`
          : `${result.completedChapter.title} concluído. Todos os capítulos publicados foram finalizados.`,
      revision: result.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function deleteVirtualTableMapAction(input: {
  campaignSlug: string;
  tableId: string;
  mapId: string;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = z
      .object({ campaignSlug: slugSchema, tableId: idSchema, mapId: idSchema })
      .safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Mapa inválido.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const map = await repositories.tabletop.findMapById(parsed.data.mapId);
    if (!map || map.campaignId !== context.campaign.id) {
      throw new TabletopActionError("Mapa não encontrado nesta campanha.");
    }
    const deletion = await repositories.tabletop.deleteMap(map.id);
    if (!deletion.deleted) throw new TabletopActionError("Mapa não encontrado.");
    await removeTabletopFiles([deletion.fileId]);
    const table = await repositories.tabletop.findById(context.table.id);
    return {
      ok: true,
      message: `${map.name} foi removido da biblioteca.`,
      revision: table?.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function resetVirtualTableMapAction(input: {
  campaignSlug: string;
  tableId: string;
}): Promise<TabletopCommandResult> {
  try {
    const parsed = z
      .object({ campaignSlug: slugSchema, tableId: idSchema })
      .safeParse(input);
    if (!parsed.success) throw new TabletopActionError("Mesa inválida.");
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    requireGameMaster(context.canManage);
    const maps = await repositories.tabletop.listMapsByCampaign(
      context.campaign.id,
    );
    const defaultMap = maps.find((map) => map.builtIn) ?? maps[0];
    if (!defaultMap) throw new TabletopActionError("A campanha ainda não possui mapas.");
    const result = await repositories.tabletop.activateMap(
      context.table.id,
      defaultMap.id,
    );
    if (!result) throw new TabletopActionError("A mesa não está mais aberta.");
    return {
      ok: true,
      message: "Mapa inicial restaurado.",
      revision: result.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export type UpdateCharacterLoadoutInput = z.infer<typeof loadoutSchema>;

export async function updateCharacterLoadoutAction(
  input: UpdateCharacterLoadoutInput,
): Promise<TabletopCommandResult> {
  try {
    const parsed = loadoutSchema.safeParse(input);
    if (!parsed.success) {
      throw new TabletopActionError("Revise equipamentos, ferimentos e mochila.");
    }
    const context = await openTableContext(
      parsed.data.campaignSlug,
      parsed.data.tableId,
    );
    const character = await repositories.characters.findById(
      parsed.data.characterId,
    );
    if (!character || character.campaignId !== context.campaign.id) {
      throw new TabletopActionError("Personagem não encontrado nesta campanha.");
    }
    if (!context.canManage && character.userId !== context.authSession.user.id) {
      throw new TabletopActionError("Você só pode editar o inventário do seu personagem.");
    }
    const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()))];
    const backpackItems = unique(parsed.data.backpackItems);
    if (backpackItems.length > parsed.data.inventorySlots) {
      throw new TabletopActionError(
        `A mochila tem ${backpackItems.length} itens, mas apenas ${parsed.data.inventorySlots} slots.`,
      );
    }
    const updated = await repositories.characters.update(character.id, {
      equipment: unique(parsed.data.equipment),
      wounds: unique(parsed.data.wounds),
      backpackItems,
      inventorySlots: parsed.data.inventorySlots,
    });
    if (!updated) throw new TabletopActionError("Personagem não encontrado.");
    refreshTablePages(context.campaign);
    return {
      ok: true,
      message: `Inventário de ${updated.name} atualizado.`,
      revision: context.table.revision,
    };
  } catch (error) {
    return commandError(error);
  }
}

export async function rollVirtualTableDiceAction(input: {
  campaignSlug: string;
  tableId: string;
  expression: string;
}): Promise<TabletopCommandResult> {
  try {
    const parsedInput = rollSchema.safeParse(input);
    if (!parsedInput.success) throw new TabletopActionError("Comando de dados inválido.");
    const context = await openTableContext(
      parsedInput.data.campaignSlug,
      parsedInput.data.tableId,
    );
    const parsedDice = parseDiceExpression(parsedInput.data.expression);
    if (!parsedDice) {
      throw new TabletopActionError(
        "Use comandos como 1d20, 2d6+3 ou 1d100.",
      );
    }
    const dice = rollParsedDice(parsedDice, (sides) => randomInt(1, sides + 1));
    const result = await repositories.tabletop.createRoll({
      tableId: context.table.id,
      campaignId: context.campaign.id,
      sessionId: context.campaignSession.id,
      userId: context.authSession.user.id,
      actorName: context.authSession.user.name,
      expression: dice.expression,
      diceValues: dice.diceValues,
      modifier: dice.modifier,
      total: dice.total,
    });
    return {
      ok: true,
      message: `${result.roll.actorName} rolou ${result.roll.expression} → ${result.roll.total}`,
      revision: result.table.revision,
      roll: result.roll,
    };
  } catch (error) {
    return commandError(error);
  }
}
