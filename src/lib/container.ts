import "server-only";

import type { AuthProvider } from "@/application/auth/auth-provider";
import type { CampaignReadRepository } from "@/application/campaigns/campaign-read-repository";
import type { FileStorageProvider } from "@/application/storage/file-storage-provider";
import type { TabletopReadRepository } from "@/application/tabletop/tabletop-read-repository";
import type { RepositoryRegistry } from "@/domain/repositories";
import { LocalAuthProvider } from "@/infrastructure/local/local-auth-provider";
import { LocalCampaignReadRepository } from "@/infrastructure/local/local-campaign-read-repository";
import { LocalFileStorageProvider } from "@/infrastructure/local/local-file-storage-provider";
import { LocalTabletopReadRepository } from "@/infrastructure/local/local-tabletop-read-repository";
import { JsonDatabase } from "@/infrastructure/local/json-database";
import { createLocalRepositories } from "@/infrastructure/local/local-repositories";
import { SupabaseAuthProvider } from "@/infrastructure/supabase/supabase-auth-provider";
import { SupabaseCampaignReadRepository } from "@/infrastructure/supabase/supabase-campaign-read-repository";
import { SupabaseFileStorageProvider } from "@/infrastructure/supabase/supabase-file-storage-provider";
import { createSupabaseRepositories } from "@/infrastructure/supabase/supabase-repositories";
import { SupabaseTabletopReadRepository } from "@/infrastructure/supabase/supabase-tabletop-read-repository";
import { SupabaseTabletopRepository } from "@/infrastructure/supabase/supabase-tabletop-repository";
import { createClient } from "@/lib/supabase/server";

const localDatabase = new JsonDatabase();
const localFileStorageProvider = new LocalFileStorageProvider();

const localRepositories: RepositoryRegistry =
  createLocalRepositories(localDatabase);
const localAuthProvider: AuthProvider = new LocalAuthProvider(localDatabase);
const localCampaignReadRepository: CampaignReadRepository =
  new LocalCampaignReadRepository(localDatabase);
const localTabletopReadRepository: TabletopReadRepository =
  new LocalTabletopReadRepository(localDatabase, localFileStorageProvider);

const supabaseFileStorageProvider = new SupabaseFileStorageProvider();
const useSupabase =
  process.env.RPG_DATA_PROVIDER?.trim().toLocaleLowerCase("en-US") === "supabase";

type RequestClient = Awaited<ReturnType<typeof createClient>>;

function requestScoped<T extends object>(
  factory: (client: RequestClient) => T,
): T {
  return new Proxy({} as T, {
    get(_target, property) {
      if (property === "then") return undefined;

      return async (...args: unknown[]) => {
        const client = await createClient();
        const instance = factory(client);
        const member = Reflect.get(instance, property);

        if (typeof member !== "function") {
          return member;
        }

        return member.apply(instance, args);
      };
    },
  });
}

function supabaseRepository<K extends keyof RepositoryRegistry>(
  key: K,
): RepositoryRegistry[K] {
  return requestScoped((client) => {
    const tabletop = new SupabaseTabletopRepository(client);
    return createSupabaseRepositories(client, tabletop)[key];
  });
}

const supabaseRepositories: RepositoryRegistry = {
  users: supabaseRepository("users"),
  campaigns: supabaseRepository("campaigns"),
  campaignChapters: supabaseRepository("campaignChapters"),
  campaignMembers: supabaseRepository("campaignMembers"),
  characters: supabaseRepository("characters"),
  characterStatusOptions: supabaseRepository("characterStatusOptions"),
  characterClassOptions: supabaseRepository("characterClassOptions"),
  teams: supabaseRepository("teams"),
  teamMembers: supabaseRepository("teamMembers"),
  missions: supabaseRepository("missions"),
  missionParticipants: supabaseRepository("missionParticipants"),
  campaignSessions: supabaseRepository("campaignSessions"),
  sessionParticipants: supabaseRepository("sessionParticipants"),
  campaignEvents: supabaseRepository("campaignEvents"),
  files: supabaseRepository("files"),
  fileRelations: supabaseRepository("fileRelations"),
  tabletop: supabaseRepository("tabletop"),
  dashboardSummary: supabaseRepository("dashboardSummary"),
};

const supabaseCampaignReadRepository: CampaignReadRepository = requestScoped(
  (client) => new SupabaseCampaignReadRepository(client),
);

const supabaseTabletopReadRepository: TabletopReadRepository = requestScoped(
  (client) =>
    new SupabaseTabletopReadRepository(client, supabaseFileStorageProvider),
);

export const repositories: RepositoryRegistry = useSupabase
  ? supabaseRepositories
  : localRepositories;

export const authProvider: AuthProvider = useSupabase
  ? new SupabaseAuthProvider()
  : localAuthProvider;

export const campaignReadRepository: CampaignReadRepository = useSupabase
  ? supabaseCampaignReadRepository
  : localCampaignReadRepository;

export const tabletopReadRepository: TabletopReadRepository = useSupabase
  ? supabaseTabletopReadRepository
  : localTabletopReadRepository;

export const fileStorageProvider: FileStorageProvider = useSupabase
  ? supabaseFileStorageProvider
  : localFileStorageProvider;