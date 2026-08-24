import "server-only";

import { randomUUID } from "node:crypto";

import {
  InvalidStoredFileError,
  type FileStorageProvider,
  type StoredFileContent,
  type StoredFileObject,
  type StoreFileInput,
} from "@/application/storage/file-storage-provider";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "campaign-media";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", signature: "jpeg" },
  "image/png": { extension: "png", signature: "png" },
  "image/webp": { extension: "webp", signature: "webp" },
  "image/avif": { extension: "avif", signature: "avif" },
} as const;

function hasExpectedSignature(
  bytes: Uint8Array,
  signature: (typeof IMAGE_TYPES)[keyof typeof IMAGE_TYPES]["signature"],
): boolean {
  if (signature === "jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (signature === "png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (signature === "webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return (
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
    ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12)))
  );
}

function safeSegments(key: string): string[] | null {
  const segments = key.split("/").filter(Boolean);
  if (
    segments.length !== 2 ||
    !UUID_PATTERN.test(segments[0]) ||
    !/^[A-Za-z0-9._-]+$/.test(segments[1])
  ) {
    return null;
  }
  return segments;
}

function isNotFound(error: unknown): boolean {
  const status = (error as { statusCode?: string | number })?.statusCode;
  return status === 404 || status === "404";
}

export class SupabaseFileStorageProvider implements FileStorageProvider {
  async store(input: StoreFileInput): Promise<StoredFileObject> {
    const imageType = IMAGE_TYPES[input.mimeType as keyof typeof IMAGE_TYPES];
    if (!imageType) {
      throw new InvalidStoredFileError(
        "Envie uma imagem JPEG, PNG, WebP ou AVIF.",
      );
    }
    if (!input.bytes.length || input.bytes.length > MAX_IMAGE_BYTES) {
      throw new InvalidStoredFileError("A imagem deve ter no máximo 6 MB.");
    }
    if (!hasExpectedSignature(input.bytes, imageType.signature)) {
      throw new InvalidStoredFileError(
        "O conteúdo do arquivo não corresponde ao formato informado.",
      );
    }
    if (!UUID_PATTERN.test(input.campaignId)) {
      throw new InvalidStoredFileError("Identificador de campanha inválido.");
    }

    const key = `${input.campaignId}/${randomUUID()}.${imageType.extension}`;
    const client = await createClient();
    const { error } = await client.storage.from(BUCKET).upload(key, input.bytes, {
      cacheControl: "3600",
      contentType: input.mimeType,
      upsert: false,
    });
    if (error) throw error;

    return {
      key,
      originalName:
        input.originalName.replace(/^.*[\\/]/, "").trim() || "imagem",
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
    };
  }

  async remove(key: string): Promise<void> {
    if (!safeSegments(key)) return;
    const client = await createClient();
    const { error } = await client.storage.from(BUCKET).remove([key]);
    if (error && !isNotFound(error)) throw error;
  }

  async getDownloadUrl(key: string): Promise<string> {
    const segments = safeSegments(key);
    if (!segments) {
      throw new InvalidStoredFileError("Chave de arquivo inválida.");
    }
    // A stable same-origin URL lets the existing /media route apply campaign
    // authorization before downloading from the private bucket.
    return `/media/${segments.map(encodeURIComponent).join("/")}`;
  }

  async read(key: string): Promise<StoredFileContent | null> {
    if (!safeSegments(key)) return null;
    const client = await createClient();
    const { data, error } = await client.storage.from(BUCKET).download(key);
    if (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    if (!data) return null;

    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      mimeType: data.type || "application/octet-stream",
    };
  }
}
