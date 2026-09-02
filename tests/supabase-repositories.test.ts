import { describe, expect, it, vi } from "vitest";

import type { VirtualTableToken } from "@/domain/entities";
import type { CreateEntityInput } from "@/domain/repositories";
import {
  createSupabaseDataRepositories,
  type SealRpgSupabaseClient,
} from "@/infrastructure/supabase/supabase-repositories";
import { SupabaseTabletopRepository } from "@/infrastructure/supabase/supabase-tabletop-repository";

describe("repositórios Supabase", () => {
  it("envia o usuário criador ao cadastrar os metadados de uma imagem", async () => {
    const campaignId = "10000000-0000-4000-8000-000000000001";
    const creatorId = "b504e622-cce8-459b-a61e-dda7569a3f5b";
    const fileId = "20000000-0000-4000-8000-000000000001";
    const timestamp = "2026-08-28T12:00:00.000Z";
    const single = vi.fn(async () => ({
      data: {
        id: fileId,
        campaign_id: campaignId,
        created_by_user_id: creatorId,
        name: "Token — Guarda",
        description: "Imagem da mesa.",
        category: "image",
        visibility: "members",
        storage_key: `${campaignId}/token.png`,
        mime_type: "image/png",
        size_bytes: 512,
        created_at: timestamp,
        updated_at: timestamp,
      },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SealRpgSupabaseClient;

    const file = await createSupabaseDataRepositories(client).files.create({
      campaignId,
      createdByUserId: creatorId,
      name: "Token — Guarda",
      description: "Imagem da mesa.",
      category: "image",
      visibility: "members",
      storageKey: `${campaignId}/token.png`,
      mimeType: "image/png",
      sizeBytes: 512,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign_id: campaignId,
        created_by_user_id: creatorId,
      }),
    );
    expect(file.createdByUserId).toBe(creatorId);
  });

  it("envia cinco tokens em um único insert atômico", async () => {
    const tableId = "30000000-0000-4000-8000-000000000001";
    const campaignId = "10000000-0000-4000-8000-000000000001";
    const sessionId = "40000000-0000-4000-8000-000000000001";
    const mapId = "12000000-0000-4000-8000-000000000001";
    const imageFileId = "20000000-0000-4000-8000-000000000001";
    const creatorId = "b504e622-cce8-459b-a61e-dda7569a3f5b";
    const timestamp = "2026-08-28T12:00:00.000Z";
    const inputs: CreateEntityInput<VirtualTableToken>[] = Array.from(
      { length: 5 },
      (_, index) => ({
        tableId,
        mapId,
        name: `Guarda ${String(index + 1).padStart(2, "0")}`,
        kind: "npc",
        characterId: null,
        imageFileId,
        x: 0.34 + index * 0.07,
        y: 0.42,
        size: 0.04,
        zIndex: index + 1,
        visible: true,
        disposition: "hostile",
        accentColor: "#ef4444",
        notes: "Patrulha inimiga.",
        collectible: false,
        rotation: 0,
        visionEnabled: true,
        visionAngle: 70,
        visionRange: 0.18,
        visionColor: "#ef4444",
      }),
    );
    const tableRows = [1, 6].map((revision) => ({
      id: tableId,
      campaign_id: campaignId,
      session_id: sessionId,
      status: "open",
      map_file_id: null,
      active_map_id: mapId,
      revision,
      opened_by_user_id: creatorId,
      opened_at: timestamp,
      closed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    }));
    const tokenRows = inputs.map((input, index) => ({
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      table_id: tableId,
      campaign_id: campaignId,
      map_id: mapId,
      name: input.name,
      kind: input.kind,
      character_id: null,
      image_file_id: imageFileId,
      x: input.x,
      y: input.y,
      size: input.size,
      z_index: input.zIndex,
      visible: input.visible,
      disposition: "hostile",
      accent_color: "#ef4444",
      notes: "Patrulha inimiga.",
      collectible: false,
      rotation: 0,
      vision_enabled: true,
      vision_angle: 70,
      vision_range: 0.18,
      vision_color: "#ef4444",
      created_at: timestamp,
      updated_at: timestamp,
    }));
    const maybeSingle = vi.fn(async () => ({
      data: tableRows.shift() ?? null,
      error: null,
    }));
    const tableSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    }));
    const tokenSelect = vi.fn(async () => ({ data: tokenRows, error: null }));
    let insertedRows: unknown[] = [];
    const insert = vi.fn((rows: unknown[]) => {
      insertedRows = rows;
      return { select: tokenSelect };
    });
    const client = {
      from: vi.fn((table: string) =>
        table === "virtual_tables" ? { select: tableSelect } : { insert },
      ),
    } as unknown as SealRpgSupabaseClient;

    const result = await new SupabaseTabletopRepository(client).createTokens(
      inputs,
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertedRows).toHaveLength(5);
    expect(insertedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Guarda 01",
          image_file_id: imageFileId,
        }),
        expect.objectContaining({
          name: "Guarda 05",
          image_file_id: imageFileId,
        }),
      ]),
    );
    expect(result.tokens).toHaveLength(5);
    expect(result.table.revision).toBe(6);
  });

  it("traduz o conflito de personagem duplicado em uma mensagem amigável", async () => {
    const tableId = "30000000-0000-4000-8000-000000000001";
    const campaignId = "10000000-0000-4000-8000-000000000001";
    const sessionId = "40000000-0000-4000-8000-000000000001";
    const mapId = "12000000-0000-4000-8000-000000000001";
    const characterId = "50000000-0000-4000-8000-000000000001";
    const creatorId = "b504e622-cce8-459b-a61e-dda7569a3f5b";
    const timestamp = "2026-08-28T12:00:00.000Z";
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: tableId,
        campaign_id: campaignId,
        session_id: sessionId,
        status: "open",
        map_file_id: null,
        active_map_id: mapId,
        revision: 6,
        opened_by_user_id: creatorId,
        opened_at: timestamp,
        closed_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      },
      error: null,
    }));
    const tableSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    }));
    const tokenSelect = vi.fn(async () => ({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "virtual_table_tokens_character_once_idx"',
        details: `Key (table_id, character_id)=(${tableId}, ${characterId}) already exists.`,
      },
    }));
    const insert = vi.fn(() => ({ select: tokenSelect }));
    const client = {
      from: vi.fn((table: string) =>
        table === "virtual_tables" ? { select: tableSelect } : { insert },
      ),
    } as unknown as SealRpgSupabaseClient;

    await expect(
      new SupabaseTabletopRepository(client).createToken({
        tableId,
        mapId,
        name: "Operador duplicado",
        kind: "character",
        characterId,
        imageFileId: null,
        x: 0.4,
        y: 0.45,
        size: 0.04,
        zIndex: 2,
        visible: true,
        disposition: "player",
        accentColor: "#38bdf8",
        notes: "",
        collectible: false,
        rotation: 0,
        visionEnabled: true,
        visionAngle: 70,
        visionRange: 0.18,
        visionColor: "#38bdf8",
      }),
    ).rejects.toMatchObject({
      message: "Este personagem já possui um token nesta mesa.",
    });
  });

  it("chama a RPC atômica para voltar ao capítulo anterior", async () => {
    const tableId = "30000000-0000-4000-8000-000000000001";
    const campaignId = "10000000-0000-4000-8000-000000000001";
    const sessionId = "40000000-0000-4000-8000-000000000001";
    const currentChapterId = "11000000-0000-4000-8000-000000000002";
    const previousChapterId = "11000000-0000-4000-8000-000000000001";
    const userId = "b504e622-cce8-459b-a61e-dda7569a3f5b";
    const timestamp = "2026-08-28T12:00:00.000Z";
    const chapterRow = (id: string, title: string, order: number) => ({
      id,
      campaign_id: campaignId,
      title,
      slug: title.toLowerCase().replaceAll(" ", "-"),
      short_description: "Resumo",
      description: "Descrição",
      background_image_url: null,
      background_image_storage_key: null,
      sort_order: order,
      status: "published",
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
    const rpc = vi.fn(async () => ({
      data: {
        table: {
          id: tableId,
          campaign_id: campaignId,
          session_id: sessionId,
          status: "open",
          map_file_id: null,
          active_map_id: "12000000-0000-4000-8000-000000000006",
          revision: 9,
          opened_by_user_id: userId,
          opened_at: timestamp,
          closed_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        },
        restoredChapter: chapterRow(previousChapterId, "O Prólogo", 1),
        formerCurrentChapter: chapterRow(
          currentChapterId,
          "Missão Suicida",
          2,
        ),
      },
      error: null,
    }));
    const client = { rpc } as unknown as SealRpgSupabaseClient;

    const result = await new SupabaseTabletopRepository(client).rollbackChapter({
      tableId,
      currentChapterId,
      previousChapterId,
      requestedByUserId: userId,
      occurredAt: timestamp,
    });

    expect(rpc).toHaveBeenCalledWith("rollback_virtual_table_chapter", {
      target_table_id: tableId,
      expected_current_chapter_id: currentChapterId,
      expected_previous_chapter_id: previousChapterId,
    });
    expect(result).toMatchObject({
      table: { id: tableId, revision: 9 },
      restoredChapter: { id: previousChapterId, completedAt: null },
      formerCurrentChapter: { id: currentChapterId },
    });
  });
});
