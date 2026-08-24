import "server-only";

import type { EntityId } from "@/domain/entities";
import { fileStorageProvider, repositories } from "@/lib/container";

/** Removes table-only uploads and their metadata without blocking the game flow. */
export async function removeTabletopFiles(
  fileIds: Array<EntityId | null | undefined>,
): Promise<void> {
  const uniqueIds = [...new Set(fileIds.filter((id): id is EntityId => Boolean(id)))];

  for (const fileId of uniqueIds) {
    try {
      const file = await repositories.files.findById(fileId);
      if (!file) continue;
      const relations = await repositories.fileRelations.listByFile(file.id);
      for (const relation of relations) {
        await repositories.fileRelations.delete(relation.id);
      }
      await repositories.files.delete(file.id);
      if (file.storageKey) await fileStorageProvider.remove(file.storageKey);
    } catch (error) {
      console.warn("Não foi possível limpar uma imagem antiga da mesa.", error);
    }
  }
}
