import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  FileStorageProvider,
  StoredFileContent,
  StoredFileObject,
  StoreFileInput,
} from "@/application/storage/file-storage-provider";
import { InvalidStoredFileError } from "@/application/storage/file-storage-provider";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

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
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        !/^[a-zA-Z0-9._-]+$/.test(segment),
    )
  ) {
    return null;
  }
  return segments;
}

export class LocalFileStorageProvider implements FileStorageProvider {
  private readonly rootPath: string;

  constructor(options?: { rootPath?: string }) {
    this.rootPath =
      options?.rootPath ?? path.join(process.cwd(), ".local", "uploads");
  }

  async store(input: StoreFileInput): Promise<StoredFileObject> {
    const imageType = IMAGE_TYPES[input.mimeType as keyof typeof IMAGE_TYPES];
    if (!imageType) {
      throw new InvalidStoredFileError(
        "Envie uma imagem JPEG, PNG, WebP ou AVIF.",
      );
    }
    if (!input.bytes.length || input.bytes.length > MAX_IMAGE_BYTES) {
      throw new InvalidStoredFileError(
        "A imagem deve ter no máximo 6 MB.",
      );
    }
    if (!hasExpectedSignature(input.bytes, imageType.signature)) {
      throw new InvalidStoredFileError(
        "O conteúdo do arquivo não corresponde ao formato informado.",
      );
    }

    const campaignSegment = input.campaignId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!campaignSegment) {
      throw new InvalidStoredFileError("Identificador de campanha inválido.");
    }
    const filename = `${randomUUID()}.${imageType.extension}`;
    const directory = path.join(this.rootPath, campaignSegment);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(/*turbopackIgnore: true*/ directory, filename),
      input.bytes,
      { flag: "wx" },
    );

    return {
      key: `${campaignSegment}/${filename}`,
      originalName: path.basename(input.originalName),
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
    };
  }

  async remove(key: string): Promise<void> {
    const target = this.resolveKey(key);
    if (!target) return;
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    const segments = safeSegments(key);
    if (!segments) {
      throw new InvalidStoredFileError("Chave de arquivo inválida.");
    }
    return `/media/${segments.map(encodeURIComponent).join("/")}`;
  }

  async read(key: string): Promise<StoredFileContent | null> {
    const target = this.resolveKey(key);
    if (!target) return null;
    try {
      const bytes = await readFile(target);
      const extension = path.extname(target).slice(1).toLocaleLowerCase("en-US");
      const mimeType =
        extension === "jpg"
          ? "image/jpeg"
          : extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : extension === "avif"
                ? "image/avif"
                : null;
      return mimeType ? { bytes: Uint8Array.from(bytes), mimeType } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private resolveKey(key: string): string | null {
    const segments = safeSegments(key);
    if (!segments) return null;
    const target = path.resolve(this.rootPath, ...segments);
    const root = `${path.resolve(this.rootPath)}${path.sep}`;
    return target.startsWith(root) ? target : null;
  }
}
