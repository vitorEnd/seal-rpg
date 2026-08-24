import "server-only";

import type { AuthProvider } from "@/application/auth/auth-provider";
import type { CampaignReadRepository } from "@/application/campaigns/campaign-read-repository";
import type { TabletopReadRepository } from "@/application/tabletop/tabletop-read-repository";
import type { RepositoryRegistry } from "@/domain/repositories";
import { LocalAuthProvider } from "@/infrastructure/local/local-auth-provider";
import { LocalCampaignReadRepository } from "@/infrastructure/local/local-campaign-read-repository";
import { LocalFileStorageProvider } from "@/infrastructure/local/local-file-storage-provider";
import { LocalTabletopReadRepository } from "@/infrastructure/local/local-tabletop-read-repository";
import { JsonDatabase } from "@/infrastructure/local/json-database";
import { createLocalRepositories } from "@/infrastructure/local/local-repositories";

const localDatabase = new JsonDatabase();
const localFileStorageProvider = new LocalFileStorageProvider();

export const repositories: RepositoryRegistry =
  createLocalRepositories(localDatabase);

export const authProvider: AuthProvider = new LocalAuthProvider(localDatabase);

export const campaignReadRepository: CampaignReadRepository =
  new LocalCampaignReadRepository(localDatabase);

export const tabletopReadRepository: TabletopReadRepository =
  new LocalTabletopReadRepository(localDatabase, localFileStorageProvider);

export const fileStorageProvider = localFileStorageProvider;
