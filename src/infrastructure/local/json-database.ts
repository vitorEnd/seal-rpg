import "server-only";

import { randomUUID } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  normalizeCharacterAttributeBonuses,
  normalizeCharacterAttributes,
} from "@/domain/character-attributes";
import type { LocalDatabase } from "@/infrastructure/local/local-database.types";
import type {
  Campaign,
  CampaignChapter,
  VirtualTableChapterTransition,
  VirtualTableMap,
} from "@/domain/entities";

const REQUIRED_V1_COLLECTIONS = [
  "users",
  "campaigns",
  "campaignMembers",
  "characters",
  "teams",
  "teamMembers",
  "missions",
  "missionParticipants",
  "campaignSessions",
  "sessionParticipants",
  "campaignEvents",
  "files",
  "fileRelations",
  "authCredentials",
  "authSessions",
] as const;

const REQUIRED_V2_COLLECTIONS = [
  ...REQUIRED_V1_COLLECTIONS,
  "campaignChapters",
  "characterStatusOptions",
  "characterClassOptions",
] as const;

const REQUIRED_V3_COLLECTIONS = [
  ...REQUIRED_V2_COLLECTIONS,
  "virtualTables",
  "virtualTableTokens",
  "diceRolls",
] as const;

const REQUIRED_V4_COLLECTIONS = [
  ...REQUIRED_V3_COLLECTIONS,
  "virtualTableMaps",
] as const;

const REQUIRED_V5_COLLECTIONS = REQUIRED_V4_COLLECTIONS;
const REQUIRED_V6_COLLECTIONS = REQUIRED_V5_COLLECTIONS;

const NEPTUNE_MAP_IDS = {
  shipMain: "12000000-0000-4000-8000-000000000001",
  shipUpper: "12000000-0000-4000-8000-000000000002",
  shipLower: "12000000-0000-4000-8000-000000000003",
  sealBase: "12000000-0000-4000-8000-000000000004",
  helipad: "12000000-0000-4000-8000-000000000005",
  insertionZone: "12000000-0000-4000-8000-000000000006",
  industrialExterior: "12000000-0000-4000-8000-000000000007",
  industrialWarehouse: "12000000-0000-4000-8000-000000000008",
  industrialControl: "12000000-0000-4000-8000-000000000009",
  safehouseExterior: "12000000-0000-4000-8000-000000000010",
  safehouseGroundFloor: "12000000-0000-4000-8000-000000000011",
  safehouseBasement: "12000000-0000-4000-8000-000000000012",
} as const;

function builtInTableMaps(campaigns: Campaign[]): VirtualTableMap[] {
  const campaign = campaigns.find((item) => item.slug === "operacao-neptune");
  if (!campaign) return [];
  const timestamp = "2026-08-23T12:00:00.000Z";
  const common = {
    campaignId: campaign.id,
    imageFileId: null,
    builtIn: true,
    createdByUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as const;
  return [
    {
      ...common,
      id: NEPTUNE_MAP_IDS.shipMain,
      name: "Navio cargueiro — convés principal",
      description: "Convés de carga da primeira missão, sob cobertura da noite.",
      groupName: "Navio cargueiro",
      layerName: "Convés principal",
      builtInImageUrl: "/art/maps/neptune-cargo-ship-main-deck.png",
      scale: "huge",
      order: 10,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.shipUpper,
      name: "Navio cargueiro — convés superior",
      description: "Ponte, passarelas e estruturas superiores do cargueiro.",
      groupName: "Navio cargueiro",
      layerName: "Convés superior",
      builtInImageUrl: "/art/maps/neptune-cargo-ship-upper-deck.png",
      scale: "huge",
      order: 11,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.shipLower,
      name: "Navio cargueiro — nível inferior",
      description: "Porões, corredores técnicos e compartimentos abaixo do convés.",
      groupName: "Navio cargueiro",
      layerName: "Nível inferior",
      builtInImageUrl: "/art/maps/neptune-cargo-ship-lower-deck.png",
      scale: "huge",
      order: 12,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.sealBase,
      name: "Base dos SEALs",
      description: "Complexo operacional com sede, escritórios e alojamentos.",
      groupName: "Base dos SEALs",
      layerName: "Complexo principal",
      builtInImageUrl: "/art/maps/neptune-seal-base.png",
      scale: "large",
      order: 20,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.helipad,
      name: "Heliporto",
      description: "Área de embarque e preparação para a inserção aérea.",
      groupName: "Heliporto",
      layerName: "Plataforma",
      builtInImageUrl: "/art/maps/neptune-helipad.png",
      scale: "medium",
      order: 30,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.insertionZone,
      name: "Zona de inserção",
      description:
        "Área desértica e rochosa onde a equipe desembarca antes da infiltração.",
      groupName: "Zona de inserção",
      layerName: "Área principal",
      builtInImageUrl: "/art/maps/neptune-insertion-zone.png",
      scale: "medium",
      order: 40,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.industrialExterior,
      name: "Complexo industrial costeiro — área externa",
      description:
        "Perímetro murado, pátio logístico, contêineres e acessos ao complexo.",
      groupName: "Complexo industrial costeiro",
      layerName: "Área externa",
      builtInImageUrl: "/art/maps/neptune-industrial-complex-exterior.png",
      scale: "large",
      order: 50,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.industrialWarehouse,
      name: "Complexo industrial costeiro — galpão principal",
      description:
        "Galpão de carga com caixas, veículos, depósitos e espaço amplo para confronto.",
      groupName: "Complexo industrial costeiro",
      layerName: "Galpão principal",
      builtInImageUrl: "/art/maps/neptune-industrial-complex-warehouse.png",
      scale: "large",
      order: 51,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.industrialControl,
      name: "Complexo industrial costeiro — administração e controle",
      description:
        "Escritórios, arquivo, comunicações e sala de controle da instalação.",
      groupName: "Complexo industrial costeiro",
      layerName: "Administração e controle",
      builtInImageUrl: "/art/maps/neptune-industrial-complex-control.png",
      scale: "large",
      order: 52,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.safehouseExterior,
      name: "Safehouse urbano — rua e exterior",
      description:
        "Casa segura discreta em uma rua estreita, cercada por muros de concreto.",
      groupName: "Safehouse urbano",
      layerName: "Rua e exterior",
      builtInImageUrl: "/art/maps/neptune-safehouse-exterior.png",
      scale: "medium",
      order: 60,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.safehouseGroundFloor,
      name: "Safehouse urbano — térreo",
      description:
        "Interior compacto com sala, cozinha, banheiro, depósito e material operacional.",
      groupName: "Safehouse urbano",
      layerName: "Térreo",
      builtInImageUrl: "/art/maps/neptune-safehouse-ground-floor.png",
      scale: "medium",
      order: 61,
    },
    {
      ...common,
      id: NEPTUNE_MAP_IDS.safehouseBasement,
      name: "Safehouse urbano — porão oculto",
      description:
        "Camada subterrânea improvisada com documentos, comunicações e suprimentos escondidos.",
      groupName: "Safehouse urbano",
      layerName: "Porão oculto",
      builtInImageUrl: "/art/maps/neptune-safehouse-basement.png",
      scale: "medium",
      order: 62,
    },
  ];
}

type ErrorWithCode = Error & { code?: string };

interface DatabaseProcessState {
  readyPromise: Promise<void> | null;
  writeQueue: Promise<void>;
}

const databaseGlobal = globalThis as typeof globalThis & {
  __rpgVitinDatabaseStates?: Map<string, DatabaseProcessState>;
};
const databaseProcessStates =
  databaseGlobal.__rpgVitinDatabaseStates ??=
    new Map<string, DatabaseProcessState>();

function hasCollections(
  candidate: Record<string, unknown>,
  collections: readonly string[],
): boolean {
  return collections.every((collection) => Array.isArray(candidate[collection]));
}

function normalizeLocalDatabase(value: unknown): LocalDatabase | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== 1 &&
    candidate.schemaVersion !== 2 &&
    candidate.schemaVersion !== 3 &&
    candidate.schemaVersion !== 4 &&
    candidate.schemaVersion !== 5 &&
    candidate.schemaVersion !== 6
  ) {
    return null;
  }

  const requiredCollections =
    candidate.schemaVersion === 6
      ? REQUIRED_V6_COLLECTIONS
      : candidate.schemaVersion === 5
      ? REQUIRED_V5_COLLECTIONS
      : candidate.schemaVersion === 4
      ? REQUIRED_V4_COLLECTIONS
      : candidate.schemaVersion === 3
        ? REQUIRED_V3_COLLECTIONS
      : candidate.schemaVersion === 2
        ? REQUIRED_V2_COLLECTIONS
        : REQUIRED_V1_COLLECTIONS;
  if (!hasCollections(candidate, requiredCollections)) {
    return null;
  }

  const campaigns = (candidate.campaigns as Array<Record<string, unknown>>).map(
    (campaign) => ({
      ...campaign,
      coverImageStorageKey:
        typeof campaign.coverImageStorageKey === "string"
          ? campaign.coverImageStorageKey
          : null,
      backgroundImageStorageKey:
        typeof campaign.backgroundImageStorageKey === "string"
          ? campaign.backgroundImageStorageKey
          : null,
    }),
  );
  const characters = (candidate.characters as Array<Record<string, unknown>>).map(
    (character) => ({
      ...character,
      userId: typeof character.userId === "string" ? character.userId : "",
      slug:
        typeof character.slug === "string"
          ? character.slug
          : String(character.name ?? "personagem")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLocaleLowerCase("pt-BR")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
      shortDescription:
        typeof character.shortDescription === "string"
          ? character.shortDescription
          : String(character.description ?? ""),
      description:
        typeof character.history === "string"
          ? character.history
          : String(character.description ?? ""),
      gender: typeof character.gender === "string" ? character.gender : "Não informado",
      statusOptionId:
        typeof character.statusOptionId === "string" ? character.statusOptionId : "",
      classOptionId:
        typeof character.classOptionId === "string" ? character.classOptionId : "",
      attributes: normalizeCharacterAttributes(character.attributes),
      coverImageUrl:
        typeof character.coverImageUrl === "string"
          ? character.coverImageUrl
          : typeof character.avatarUrl === "string"
            ? character.avatarUrl
            : null,
      coverImageStorageKey:
        typeof character.coverImageStorageKey === "string"
          ? character.coverImageStorageKey
          : null,
      backgroundImageUrl:
        typeof character.backgroundImageUrl === "string"
          ? character.backgroundImageUrl
          : null,
      backgroundImageStorageKey:
        typeof character.backgroundImageStorageKey === "string"
          ? character.backgroundImageStorageKey
          : null,
      primaryColor:
        typeof character.primaryColor === "string" ? character.primaryColor : "#e8792f",
      secondaryColor:
        typeof character.secondaryColor === "string"
          ? character.secondaryColor
          : "#66737d",
      startDate: typeof character.startDate === "string" ? character.startDate : null,
      equipment: Array.isArray(character.equipment)
        ? character.equipment.filter((item): item is string => typeof item === "string")
        : [],
      wounds: Array.isArray(character.wounds)
        ? character.wounds.filter((item): item is string => typeof item === "string")
        : [],
      backpackItems: Array.isArray(character.backpackItems)
        ? character.backpackItems.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      inventorySlots:
        typeof character.inventorySlots === "number" &&
        Number.isInteger(character.inventorySlots) &&
        character.inventorySlots >= 1 &&
        character.inventorySlots <= 40
          ? character.inventorySlots
          : 8,
    }),
  );
  const campaignChapters = (
    candidate.schemaVersion === 1
      ? []
      : (candidate.campaignChapters as Array<Record<string, unknown>>)
  ).map((chapter) => ({
    ...chapter,
    completedAt:
      typeof chapter.completedAt === "string" &&
      !Number.isNaN(Date.parse(chapter.completedAt))
        ? chapter.completedAt
        : null,
  }));
  const characterClassOptions = (
    candidate.schemaVersion === 1
      ? []
      : (candidate.characterClassOptions as Array<Record<string, unknown>>)
  ).map((characterClass) => ({
    ...characterClass,
    logoImageUrl:
      typeof characterClass.logoImageUrl === "string"
        ? characterClass.logoImageUrl
        : null,
    logoImageStorageKey:
      typeof characterClass.logoImageStorageKey === "string"
        ? characterClass.logoImageStorageKey
        : null,
    attributeBonuses: normalizeCharacterAttributeBonuses(
      characterClass.attributeBonuses,
    ),
  }));
  const campaignSessions = (
    candidate.campaignSessions as Array<Record<string, unknown>>
  ).map((session) => {
    const status =
      session.status === "scheduled" ||
      session.status === "completed" ||
      session.status === "cancelled"
        ? session.status
        : "completed";
    return {
      ...session,
      status,
      scheduledAt:
        typeof session.scheduledAt === "string" ? session.scheduledAt : null,
      occurredAt:
        typeof session.occurredAt === "string"
          ? session.occurredAt
          : status === "completed" && typeof session.scheduledAt === "string"
            ? session.scheduledAt
            : null,
    };
  });

  const migratedBuiltIns = builtInTableMaps(campaigns as LocalDatabase["campaigns"]);
  const storedMaps =
    candidate.schemaVersion === 4 ||
    candidate.schemaVersion === 5 ||
    candidate.schemaVersion === 6
      ? (candidate.virtualTableMaps as Array<Record<string, unknown>>)
      : [];
  const mapsById = new Map<string, VirtualTableMap>();
  for (const map of [...migratedBuiltIns, ...storedMaps]) {
    if (typeof map.id !== "string" || typeof map.campaignId !== "string") continue;
    mapsById.set(map.id, {
      ...(map as unknown as VirtualTableMap),
      name: typeof map.name === "string" ? map.name : "Mapa sem nome",
      description: typeof map.description === "string" ? map.description : "",
      groupName: typeof map.groupName === "string" ? map.groupName : "Mapas da campanha",
      layerName: typeof map.layerName === "string" ? map.layerName : "Camada principal",
      imageFileId: typeof map.imageFileId === "string" ? map.imageFileId : null,
      builtInImageUrl:
        typeof map.builtInImageUrl === "string" ? map.builtInImageUrl : null,
      scale:
        map.scale === "medium" || map.scale === "large" || map.scale === "huge"
          ? map.scale
          : "large",
      builtIn: map.builtIn === true,
      order: typeof map.order === "number" && Number.isFinite(map.order) ? map.order : 0,
      createdByUserId:
        typeof map.createdByUserId === "string" ? map.createdByUserId : null,
    });
  }
  const virtualTableMaps = [...mapsById.values()];
  const chaptersById = new Map(
    (campaignChapters as CampaignChapter[]).map((chapter) => [
      chapter.id,
      chapter,
    ]),
  );
  const defaultMapByCampaign = new Map<string, string>();
  for (const map of virtualTableMaps
    .slice()
    .sort((left, right) => left.order - right.order)) {
    if (!defaultMapByCampaign.has(map.campaignId)) {
      defaultMapByCampaign.set(map.campaignId, map.id);
    }
  }

  const virtualTables: Array<
    Record<string, unknown> & {
      mapFileId: string | null;
      activeMapId: string | null;
      lastChapterTransition: VirtualTableChapterTransition | null;
    }
  > =
    candidate.schemaVersion === 3 ||
    candidate.schemaVersion === 4 ||
    candidate.schemaVersion === 5 ||
    candidate.schemaVersion === 6
      ? (candidate.virtualTables as Array<Record<string, unknown>>).map((table) => {
          const campaignId = String(table.campaignId);
          const rawTransition =
            typeof table.lastChapterTransition === "object" &&
            table.lastChapterTransition !== null
              ? (table.lastChapterTransition as Record<string, unknown>)
              : null;
          const fromChapter =
            rawTransition && typeof rawTransition.fromChapterId === "string"
              ? chaptersById.get(rawTransition.fromChapterId)
              : null;
          const toChapterId =
            rawTransition?.toChapterId === null ||
            typeof rawTransition?.toChapterId === "string"
              ? rawTransition.toChapterId
              : undefined;
          const toChapter =
            typeof toChapterId === "string"
              ? chaptersById.get(toChapterId)
              : null;
          const transitionMapId =
            rawTransition?.mapId === null ||
            typeof rawTransition?.mapId === "string"
              ? rawTransition.mapId
              : undefined;
          const transitionMap =
            typeof transitionMapId === "string"
              ? mapsById.get(transitionMapId)
              : null;
          const validTransition = Boolean(
            rawTransition &&
              typeof rawTransition.id === "string" &&
              fromChapter?.campaignId === campaignId &&
              toChapterId !== undefined &&
              (toChapterId === null || toChapter?.campaignId === campaignId) &&
              transitionMapId !== undefined &&
              (transitionMapId === null || transitionMap?.campaignId === campaignId) &&
              typeof rawTransition.occurredAt === "string" &&
              !Number.isNaN(Date.parse(rawTransition.occurredAt)),
          );
          const lastChapterTransition: VirtualTableChapterTransition | null =
            validTransition && rawTransition
              ? {
                  id: rawTransition.id as string,
                  fromChapterId: rawTransition.fromChapterId as string,
                  toChapterId: toChapterId as string | null,
                  mapId: transitionMapId as string | null,
                  occurredAt: rawTransition.occurredAt as string,
                }
              : null;

          return {
            ...table,
            mapFileId: typeof table.mapFileId === "string" ? table.mapFileId : null,
            activeMapId:
              typeof table.activeMapId === "string" && mapsById.has(table.activeMapId)
                ? table.activeMapId
                : typeof table.mapFileId === "string"
                  ? null
                  : defaultMapByCampaign.get(campaignId) ?? null,
            lastChapterTransition,
          };
        })
      : [];

  const virtualTableTokens =
    candidate.schemaVersion === 3 ||
    candidate.schemaVersion === 4 ||
    candidate.schemaVersion === 5 ||
    candidate.schemaVersion === 6
      ? (candidate.virtualTableTokens as Array<Record<string, unknown>>).map((token) => {
          const tokenTable = virtualTables.find(
            (table) => table["id"] === token.tableId,
          );
          const storedMap =
            typeof token.mapId === "string" ? mapsById.get(token.mapId) : null;
          const fallbackMapId = tokenTable
            ? tokenTable.activeMapId ??
              (tokenTable.mapFileId
                ? null
                : defaultMapByCampaign.get(String(tokenTable["campaignId"])) ?? null)
            : null;
          const mapId =
            storedMap &&
            tokenTable &&
            storedMap.campaignId === tokenTable["campaignId"]
              ? storedMap.id
              : fallbackMapId;
          const kind =
            token.kind === "character" ||
            token.kind === "npc" ||
            token.kind === "enemy" ||
            token.kind === "object"
              ? token.kind
              : "npc";
          const defaultDisposition =
            kind === "character"
              ? "player"
              : kind === "enemy"
                ? "hostile"
                : kind === "object"
                  ? "object"
                  : "ally";
          const accentColor =
            typeof token.accentColor === "string" &&
            /^#[0-9a-f]{6}$/i.test(token.accentColor)
              ? token.accentColor
              : kind === "enemy"
                ? "#d45a4f"
                : kind === "object"
                  ? "#d6a45d"
                  : "#5ea7a0";
          return {
            ...token,
            mapId,
            kind,
            disposition:
              token.disposition === "player" ||
              token.disposition === "ally" ||
              token.disposition === "neutral" ||
              token.disposition === "hostile" ||
              token.disposition === "object"
                ? token.disposition
                : defaultDisposition,
            accentColor,
            notes: typeof token.notes === "string" ? token.notes : "",
            collectible: token.collectible === true,
            rotation:
              typeof token.rotation === "number" && Number.isFinite(token.rotation)
                ? ((token.rotation % 360) + 360) % 360
                : 0,
            visionEnabled:
              typeof token.visionEnabled === "boolean"
                ? token.visionEnabled
                : kind !== "object",
            visionAngle:
              typeof token.visionAngle === "number" && Number.isFinite(token.visionAngle)
                ? Math.min(180, Math.max(10, token.visionAngle))
                : 70,
            visionRange:
              typeof token.visionRange === "number" && Number.isFinite(token.visionRange)
                ? Math.min(0.6, Math.max(0.05, token.visionRange))
                : 0.22,
            visionColor:
              typeof token.visionColor === "string" &&
              /^#[0-9a-f]{6}$/i.test(token.visionColor)
                ? token.visionColor
                : accentColor,
          };
        })
      : [];

  return {
    ...(candidate as unknown as Omit<LocalDatabase, "schemaVersion">),
    schemaVersion: 6,
    campaigns: campaigns as LocalDatabase["campaigns"],
    campaignChapters:
      campaignChapters as LocalDatabase["campaignChapters"],
    characters: characters as LocalDatabase["characters"],
    characterStatusOptions:
      candidate.schemaVersion === 2 ||
      candidate.schemaVersion === 3 ||
      candidate.schemaVersion === 4 ||
      candidate.schemaVersion === 5 ||
      candidate.schemaVersion === 6
        ? (candidate.characterStatusOptions as LocalDatabase["characterStatusOptions"])
        : [],
    characterClassOptions:
      characterClassOptions as LocalDatabase["characterClassOptions"],
    campaignSessions: campaignSessions as LocalDatabase["campaignSessions"],
    virtualTables: virtualTables as unknown as LocalDatabase["virtualTables"],
    virtualTableMaps,
    virtualTableTokens: virtualTableTokens as LocalDatabase["virtualTableTokens"],
    diceRolls:
      candidate.schemaVersion === 3 ||
      candidate.schemaVersion === 4 ||
      candidate.schemaVersion === 5 ||
      candidate.schemaVersion === 6
        ? (candidate.diceRolls as LocalDatabase["diceRolls"])
        : [],
  };
}

export class JsonDatabase {
  private readonly filePath: string;
  private readonly seedPath: string;
  private readonly processState: DatabaseProcessState;

  constructor(options?: { filePath?: string; seedPath?: string }) {
    this.filePath =
      options?.filePath ??
      process.env.RPG_LOCAL_DATA_PATH ??
      path.join(process.cwd(), ".local", "rpg-vitin.json");
    this.seedPath =
      options?.seedPath ?? path.join(process.cwd(), "data", "seed.json");
    const stateKey = path.normalize(this.filePath);
    const existingState = databaseProcessStates.get(stateKey);
    this.processState =
      existingState ?? { readyPromise: null, writeQueue: Promise.resolve() };
    if (!existingState) databaseProcessStates.set(stateKey, this.processState);
  }

  get path(): string {
    return this.filePath;
  }

  async read(): Promise<LocalDatabase> {
    await this.processState.writeQueue;
    return this.readUnsafe();
  }

  async mutate<TResult>(
    mutation: (database: LocalDatabase) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    const operation = this.processState.writeQueue.then(async () => {
      const database = await this.readUnsafe();
      const result = await mutation(database);
      await this.writeUnsafe(database);
      return result;
    });

    this.processState.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }

  async reset(): Promise<void> {
    const operation = this.processState.writeQueue.then(async () => {
      this.assertLocalRuntime();
      const seedContents = await readFile(this.seedPath, "utf8");
      const seed = normalizeLocalDatabase(JSON.parse(seedContents));
      if (!seed) {
        throw new Error(`O seed em ${this.seedPath} usa um formato incompatível.`);
      }
      await this.writeUnsafe(seed);
    });

    this.processState.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }

  private async readUnsafe(): Promise<LocalDatabase> {
    await this.ensureReady();
    const contents = await readFile(this.filePath, "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch (error) {
      throw new Error(
        `Os dados locais em ${this.filePath} não contêm JSON válido. Execute npm run data:reset.`,
        { cause: error },
      );
    }

    const database = normalizeLocalDatabase(parsed);
    if (!database) {
      throw new Error(
        `Os dados locais em ${this.filePath} usam um formato incompatível. Execute npm run data:reset.`,
      );
    }

    return database;
  }

  private async writeUnsafe(database: LocalDatabase): Promise<void> {
    await this.ensureReady();
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");

    try {
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      const errorWithCode = error as ErrorWithCode;
      if (errorWithCode.code !== "EPERM" && errorWithCode.code !== "EEXIST") {
        throw error;
      }

      await copyFile(temporaryPath, this.filePath);
      await unlink(temporaryPath);
    }
  }

  private ensureReady(): Promise<void> {
    this.processState.readyPromise ??= this.initialize();
    return this.processState.readyPromise;
  }

  private async initialize(): Promise<void> {
    this.assertLocalRuntime();
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await access(this.filePath);
    } catch (error) {
      const errorWithCode = error as ErrorWithCode;
      if (errorWithCode.code !== "ENOENT") {
        throw error;
      }
      await copyFile(this.seedPath, this.filePath);
    }
  }

  private assertLocalRuntime(): void {
    if (process.env.VERCEL) {
      throw new Error(
        "O provider JSON é somente para desenvolvimento local. Substitua-o antes de hospedar a aplicação.",
      );
    }
  }
}
