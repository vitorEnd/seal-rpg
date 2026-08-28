import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseDataRepositories,
  type SealRpgSupabaseClient,
} from "@/infrastructure/supabase/supabase-repositories";

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
});
