import type { EntityId } from "@/domain/entities";

export interface StoredFileObject {
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StoreFileInput {
  campaignId: EntityId;
  originalName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface StoredFileContent {
  bytes: Uint8Array;
  mimeType: string;
}

export class InvalidStoredFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStoredFileError";
  }
}

export interface FileStorageProvider {
  store(input: StoreFileInput): Promise<StoredFileObject>;
  remove(key: string): Promise<void>;
  getDownloadUrl(key: string): Promise<string>;
  read(key: string): Promise<StoredFileContent | null>;
}
