import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { safeReturnTo } from "@/application/auth/safe-return-to";
import { dateToIso, localDateTimeToIso } from "@/application/forms/form-values";
import {
  calculateEffectiveAttributes,
  EMPTY_CHARACTER_ATTRIBUTES,
  isValidCharacterAttributes,
  LEGACY_CHARACTER_ATTRIBUTES,
} from "@/domain/character-attributes";
import { resolveCampaignChapterProgression } from "@/domain/chapter-progression";
import {
  canReadCampaignMedia,
  classifyCampaignMediaReference,
} from "@/application/storage/media-access";
import { canManageCampaign, canViewCampaign, canViewContent } from "@/domain/permissions";
import type { CreateEntityInput } from "@/domain/repositories";
import type { Campaign } from "@/domain/entities";
import { RepositoryConflictError } from "@/domain/repositories";
import { LocalAuthProvider } from "@/infrastructure/local/local-auth-provider";
import { LocalCampaignReadRepository } from "@/infrastructure/local/local-campaign-read-repository";
import { InvalidStoredFileError } from "@/application/storage/file-storage-provider";
import { LocalFileStorageProvider } from "@/infrastructure/local/local-file-storage-provider";
import { JsonDatabase } from "@/infrastructure/local/json-database";
import { createLocalRepositories } from "@/infrastructure/local/local-repositories";

const temporaryDirectories: string[] = [];

async function createTestDatabase() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rpg-vitin-test-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "database.json");
  const seedPath = path.join(process.cwd(), "data", "seed.json");
  return {
    directory,
    database: new JsonDatabase({ filePath, seedPath }),
    filePath,
    seedPath,
  };
}

function campaignInput(
  slug: string,
  name = "Campanha de Teste",
): CreateEntityInput<Campaign> {
  return {
    name,
    slug,
    shortDescription: "Campanha criada dentro de um teste automatizado.",
    description: "Uma descrição completa para validar a persistência do adapter JSON local.",
    setting: "Ambiente de teste",
    genre: "Tático",
    status: "draft",
    coverImageUrl: null,
    coverImageStorageKey: null,
    backgroundImageUrl: null,
    backgroundImageStorageKey: null,
    primaryColor: "#e8792f",
    secondaryColor: "#66737d",
    startDate: null,
    gameMasterUserId: null,
    storySummary: "Ainda não começou.",
  };
}

afterEach(async () => {
  const directories = temporaryDirectories.splice(0);
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("conteúdo inicial honesto", () => {
  it("mantém somente Neptune, O Prólogo e nenhum histórico fictício", async () => {
    const { database } = await createTestDatabase();
    const snapshot = await database.read();

    expect(snapshot.schemaVersion).toBe(6);
    expect(snapshot.campaigns.map((campaign) => campaign.slug)).toEqual([
      "operacao-neptune",
    ]);
    expect(snapshot.campaignChapters).toMatchObject([
      { title: "O Prólogo", slug: "o-prologo", order: 1, status: "published" },
    ]);
    expect(snapshot.campaignSessions).toEqual([]);
    expect(snapshot.sessionParticipants).toEqual([]);
    expect(snapshot.virtualTables).toEqual([]);
    expect(snapshot.virtualTableTokens).toEqual([]);
    expect(snapshot.diceRolls).toEqual([]);
    expect(snapshot.virtualTableMaps).toHaveLength(12);
    expect(snapshot.virtualTableMaps[0]).toMatchObject({
      name: "Navio cargueiro — convés principal",
      groupName: "Navio cargueiro",
      layerName: "Convés principal",
      scale: "huge",
      builtIn: true,
    });
    expect(snapshot.characters).toEqual([]);
    expect(snapshot.missions).toEqual([]);
    expect(snapshot.campaignEvents).toEqual([]);
    expect(snapshot.files).toEqual([]);
    expect(snapshot.campaigns.some((campaign) => campaign.slug === "ankar")).toBe(false);
  });

  it("migra um snapshot v1 sem perder identidades ou sessões de login", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const seed = JSON.parse(await readFile(seedPath, "utf8"));
    const legacy = {
      ...seed,
      schemaVersion: 1,
      authSessions: [
        {
          id: "legacy-session",
          userId: seed.users[0].id,
          tokenHash: "hash",
          createdAt: "2026-08-23T12:00:00.000Z",
          expiresAt: "2099-08-23T12:00:00.000Z",
        },
      ],
    };
    delete legacy.campaignChapters;
    delete legacy.characterStatusOptions;
    delete legacy.characterClassOptions;
    legacy.campaigns = legacy.campaigns.map((campaign: Record<string, unknown>) => {
      const copy = { ...campaign };
      delete copy.coverImageStorageKey;
      delete copy.backgroundImageStorageKey;
      return copy;
    });
    await writeFile(filePath, JSON.stringify(legacy), "utf8");

    const migrated = await database.read();
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.users).toHaveLength(3);
    expect(migrated.authSessions[0]?.id).toBe("legacy-session");
    expect(migrated.campaignChapters).toEqual([]);
    expect(migrated.virtualTables).toEqual([]);
    expect(migrated.virtualTableTokens).toEqual([]);
    expect(migrated.diceRolls).toEqual([]);
    expect(migrated.virtualTableMaps).toHaveLength(12);
    expect(migrated.campaigns[0]?.coverImageStorageKey).toBeNull();
  });

  it("migra um snapshot v2 preservando capítulos e opções de ficha", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const legacy = JSON.parse(await readFile(seedPath, "utf8"));
    legacy.schemaVersion = 2;
    delete legacy.virtualTables;
    delete legacy.virtualTableTokens;
    delete legacy.diceRolls;
    await writeFile(filePath, JSON.stringify(legacy), "utf8");

    const migrated = await database.read();
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.campaignChapters).toHaveLength(1);
    expect(migrated.characterStatusOptions.length).toBeGreaterThan(0);
    expect(migrated.characterClassOptions.length).toBeGreaterThan(0);
    expect(migrated.virtualTables).toEqual([]);
    expect(migrated.virtualTableTokens).toEqual([]);
    expect(migrated.diceRolls).toEqual([]);
    expect(migrated.virtualTableMaps).toHaveLength(12);
  });

  it("migra capítulos v5 sem inventar conclusões e bloqueia os posteriores", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const legacy = JSON.parse(await readFile(seedPath, "utf8"));
    legacy.schemaVersion = 5;
    legacy.campaignChapters = [
      {
        ...legacy.campaignChapters[0],
        completedAt: undefined,
      },
      {
        ...legacy.campaignChapters[0],
        id: "11000000-0000-4000-8000-000000000002",
        title: "Missão Suicida",
        slug: "missao-suicida",
        order: 2,
        completedAt: "data-inválida",
      },
    ];
    await writeFile(filePath, JSON.stringify(legacy), "utf8");

    const migrated = await database.read();
    const progression = resolveCampaignChapterProgression(
      migrated.campaignChapters,
    );

    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.campaignChapters.map((chapter) => chapter.completedAt)).toEqual([
      null,
      null,
    ]);
    expect(progression.entries.map((entry) => entry.state)).toEqual([
      "available",
      "locked",
    ]);
    expect(progression.currentChapter?.title).toBe("O Prólogo");
    expect(progression.nextChapter?.title).toBe("Missão Suicida");
  });

  it("migra um snapshot v4 com mapas e fichas legadas sem alterar dados existentes", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const existing = JSON.parse(await readFile(seedPath, "utf8"));
    existing.schemaVersion = 4;
    existing.virtualTableMaps = existing.virtualTableMaps.filter(
      (map: Record<string, unknown>) =>
        typeof map.order === "number" && map.order <= 30,
    );
    existing.virtualTableMaps[0].description = "Descrição local preservada";
    existing.characterClassOptions = existing.characterClassOptions.map(
      (option: Record<string, unknown>) => {
        const legacyOption = { ...option };
        delete legacyOption.attributeBonuses;
        delete legacyOption.logoImageUrl;
        delete legacyOption.logoImageStorageKey;
        return legacyOption;
      },
    );
    existing.characters = [
      {
        id: "34000000-0000-4000-8000-000000000099",
        campaignId: existing.campaigns[0].id,
        userId: existing.users[2].id,
        name: "Operador legado",
        slug: "operador-legado",
        shortDescription: "Ficha anterior ao sistema de atributos.",
        description: "Personagem preservado durante a migração do banco local.",
        gender: "Não informado",
        statusOptionId: existing.characterStatusOptions[0].id,
        classOptionId: existing.characterClassOptions[0].id,
        coverImageUrl: null,
        coverImageStorageKey: null,
        backgroundImageUrl: null,
        backgroundImageStorageKey: null,
        primaryColor: "#e8792f",
        secondaryColor: "#66737d",
        startDate: null,
        equipment: [],
        wounds: [],
        backpackItems: [],
        inventorySlots: 8,
        createdAt: "2026-08-23T12:00:00.000Z",
        updatedAt: "2026-08-23T12:00:00.000Z",
      },
    ];
    await writeFile(filePath, JSON.stringify(existing), "utf8");

    const migrated = await database.read();
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.virtualTableMaps).toHaveLength(12);
    expect(migrated.virtualTableMaps[0]?.description).toBe(
      "Descrição local preservada",
    );
    expect(migrated.virtualTableMaps.slice(5).map((map) => map.groupName)).toEqual([
      "Zona de inserção",
      "Complexo industrial costeiro",
      "Complexo industrial costeiro",
      "Complexo industrial costeiro",
      "Safehouse urbano",
      "Safehouse urbano",
      "Safehouse urbano",
    ]);
    expect(migrated.characterClassOptions[0]).toMatchObject({
      logoImageUrl: null,
      logoImageStorageKey: null,
      attributeBonuses: EMPTY_CHARACTER_ATTRIBUTES,
    });
    expect(migrated.characters[0]?.attributes).toEqual(
      LEGACY_CHARACTER_ATTRIBUTES,
    );
  });

  it("migra um snapshot v3 adicionando biblioteca, loadout e visão dos tokens", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const legacy = JSON.parse(await readFile(seedPath, "utf8"));
    legacy.schemaVersion = 3;
    delete legacy.virtualTableMaps;
    legacy.campaignSessions = [
      {
        id: "51000000-0000-4000-8000-000000000001",
        campaignId: legacy.campaigns[0].id,
        sessionNumber: 1,
        title: "Mesa legada",
        status: "scheduled",
        scheduledAt: "2027-01-01T22:00:00.000Z",
        occurredAt: null,
        summary: "",
        description: "",
        events: "",
        consequences: "",
        createdAt: "2026-08-23T12:00:00.000Z",
        updatedAt: "2026-08-23T12:00:00.000Z",
      },
    ];
    legacy.virtualTables = [
      {
        id: "52000000-0000-4000-8000-000000000001",
        campaignId: legacy.campaigns[0].id,
        sessionId: legacy.campaignSessions[0].id,
        status: "open",
        mapFileId: null,
        revision: 1,
        openedByUserId: legacy.users[1].id,
        openedAt: "2027-01-01T22:00:00.000Z",
        closedAt: null,
        createdAt: "2027-01-01T22:00:00.000Z",
        updatedAt: "2027-01-01T22:00:00.000Z",
      },
    ];
    legacy.virtualTableTokens = [
      {
        id: "53000000-0000-4000-8000-000000000001",
        tableId: legacy.virtualTables[0].id,
        name: "Token legado",
        kind: "npc",
        characterId: null,
        imageFileId: null,
        x: 0.5,
        y: 0.5,
        size: 0.055,
        zIndex: 1,
        visible: true,
        createdAt: "2027-01-01T22:00:00.000Z",
        updatedAt: "2027-01-01T22:00:00.000Z",
      },
    ];
    await writeFile(filePath, JSON.stringify(legacy), "utf8");

    const migrated = await database.read();
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.virtualTableMaps.map((map) => map.layerName)).toEqual([
      "Convés principal",
      "Convés superior",
      "Nível inferior",
      "Complexo principal",
      "Plataforma",
      "Área principal",
      "Área externa",
      "Galpão principal",
      "Administração e controle",
      "Rua e exterior",
      "Térreo",
      "Porão oculto",
    ]);
    expect(migrated.virtualTables[0]?.activeMapId).toBe(
      migrated.virtualTableMaps[0]?.id,
    );
    expect(migrated.virtualTables[0]?.lastChapterTransition).toBeNull();
    expect(migrated.virtualTableTokens[0]).toMatchObject({
      name: "Token legado",
      mapId: migrated.virtualTableMaps[0]?.id,
      disposition: "ally",
      visionEnabled: true,
    });
  });
});

describe("autenticação local DEV ONLY", () => {
  it("entra com o admin seed, mantém a sessão e revoga no logout", async () => {
    const { database } = await createTestDatabase();
    const provider = new LocalAuthProvider(database);
    const session = await provider.signIn({ identifier: "admin", password: "neptune-dev" });
    expect(session.user.role).toBe("admin");
    expect((await provider.getSession(session.token))?.user.id).toBe(session.user.id);
    await provider.signOut(session.token);
    expect(await provider.getSession(session.token)).toBeNull();
  });

  it("aceita apenas destinos internos conhecidos após o login", () => {
    expect(safeReturnTo("/campaigns/operacao-neptune?tab=sheet")).toBe(
      "/campaigns/operacao-neptune?tab=sheet",
    );
    expect(safeReturnTo("/admin?view=chapters")).toBe("/admin?view=chapters");
    expect(safeReturnTo("/\\evil.test")).toBeNull();
    expect(safeReturnTo("//evil.test/campaigns")).toBeNull();
    expect(safeReturnTo("/perfil")).toBeNull();
  });

  it("recusa senha inválida sem revelar qual credencial falhou", async () => {
    const { database } = await createTestDatabase();
    const provider = new LocalAuthProvider(database);
    await expect(provider.signIn({ identifier: "admin", password: "errada" })).rejects.toMatchObject({
      code: "invalid_credentials",
      message: "Usuário ou senha inválidos.",
    });
  });

  it("cadastro sempre cria player e preserva unicidade", async () => {
    const { database } = await createTestDatabase();
    const provider = new LocalAuthProvider(database);
    const input = {
      name: "Nova Jogadora",
      username: "nova_jogadora",
      email: "nova@rpg.test",
      password: "senha-local-123",
    };
    const session = await provider.signUp(input);
    expect(session.user.role).toBe("player");
    await expect(provider.signUp(input)).rejects.toMatchObject({ code: "duplicate_username" });
  });
});

describe("normalização estrita de datas", () => {
  it("aceita datas reais e recusa normalizações silenciosas", () => {
    expect(dateToIso("2024-02-29")).toBe("2024-02-29T12:00:00.000Z");
    expect(dateToIso("2026-02-29")).toBeNull();
    expect(dateToIso("2026-02-31")).toBeNull();
    expect(dateToIso("2026-13-01")).toBeNull();
    expect(dateToIso("não-é-data")).toBeNull();
  });

  it("aceita somente datetime-local válido no fuso configurado", () => {
    expect(localDateTimeToIso("2026-08-23T20:30")).toBe(
      "2026-08-23T23:30:00.000Z",
    );
    expect(localDateTimeToIso("2026-02-31T20:30")).toBeNull();
    expect(localDateTimeToIso("2026-08-23T24:00")).toBeNull();
    expect(localDateTimeToIso("2026-08-23T20:30:00")).toBeNull();
    expect(localDateTimeToIso("não-é-data")).toBeNull();
  });
});

describe("repositories e integridade", () => {
  it("persiste campanhas e protege o slug também durante update", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const created = await repositories.campaigns.create(campaignInput("teste-local"));
    const second = await repositories.campaigns.create(campaignInput("segundo", "Segundo"));

    const secondDatabase = new JsonDatabase({ filePath, seedPath });
    expect(await createLocalRepositories(secondDatabase).campaigns.findBySlug("teste-local")).not.toBeNull();
    await expect(
      repositories.campaigns.update(second.id, { slug: created.slug.toLocaleUpperCase("pt-BR") }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
  });

  it("serializa gravações concorrentes entre instâncias do mesmo arquivo", async () => {
    const { database, filePath, seedPath } = await createTestDatabase();
    const secondDatabase = new JsonDatabase({ filePath, seedPath });
    const firstRepositories = createLocalRepositories(database);
    const secondRepositories = createLocalRepositories(secondDatabase);

    await Promise.all([
      firstRepositories.campaigns.create(campaignInput("concorrente-a", "A")),
      secondRepositories.campaigns.create(campaignInput("concorrente-b", "B")),
    ]);

    const slugs = (await database.read()).campaigns.map((campaign) => campaign.slug);
    expect(slugs).toContain("concorrente-a");
    expect(slugs).toContain("concorrente-b");
  });

  it("captura as chaves de storage na mesma mutação que exclui a campanha", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const campaign = await repositories.campaigns.create({
      ...campaignInput("campanha-descartavel"),
      coverImageStorageKey: "campaign/cover.webp",
    });
    await repositories.characterClassOptions.create({
      campaignId: campaign.id,
      name: "Especialista",
      slug: "especialista",
      description: "Classe temporária com identidade visual própria.",
      logoImageUrl: "/media/campaign/class-logo.png",
      logoImageStorageKey: "campaign/class-logo.png",
      attributeBonuses: {
        ...EMPTY_CHARACTER_ATTRIBUTES,
        technique: 1,
      },
      order: 1,
      active: true,
    });
    const file = await repositories.files.create({
      campaignId: campaign.id,
      name: "Arquivo da campanha",
      description: "",
      category: "other",
      visibility: "members",
      storageKey: "campaign/file.png",
      mimeType: "image/png",
      sizeBytes: 32,
    });

    const deletion = await repositories.campaigns.deleteWithStorageKeys(
      campaign.id,
    );

    expect(new Set(deletion.storageKeys)).toEqual(
      new Set([
        "campaign/cover.webp",
        "campaign/class-logo.png",
        "campaign/file.png",
      ]),
    );
    expect(await repositories.campaigns.findById(campaign.id)).toBeNull();
    expect(await repositories.files.findById(file.id)).toBeNull();
  });

  it("cria capítulos em ordem e recusa slug duplicado na mesma campanha", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const neptune = await repositories.campaigns.findBySlug("operacao-neptune");
    expect(neptune).not.toBeNull();
    if (!neptune) return;
    await repositories.campaignChapters.create({
      campaignId: neptune.id,
      title: "Capítulo dois",
      slug: "capitulo-dois",
      shortDescription: "O segundo capítulo criado em teste.",
      description: "Descrição do segundo capítulo.",
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      order: 2,
      status: "draft",
    });
    await expect(
      repositories.campaignChapters.create({
        campaignId: neptune.id,
        title: "Duplicado",
        slug: "capitulo-dois",
        shortDescription: "Outro capítulo com o mesmo slug.",
        description: "Este registro deve ser recusado.",
        backgroundImageUrl: null,
        backgroundImageStorageKey: null,
        order: 3,
        status: "draft",
      }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
    expect((await repositories.campaignChapters.listByCampaign(neptune.id)).map((item) => item.order)).toEqual([1, 2]);
  });

  it("impede excluir status ou classe enquanto uma ficha usa a opção", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const [campaign, player, status, characterClass] = await Promise.all([
      repositories.campaigns.findBySlug("operacao-neptune"),
      repositories.users.findByUsername("player"),
      repositories.characterStatusOptions.list(),
      repositories.characterClassOptions.list(),
    ]);
    expect(campaign && player && status[0] && characterClass[0]).toBeTruthy();
    if (!campaign || !player || !status[0] || !characterClass[0]) return;
    const character = await repositories.characters.create({
      campaignId: campaign.id,
      userId: player.id,
      name: "Operador Teste",
      slug: "operador-teste",
      shortDescription: "Ficha criada para testar integridade.",
      description: "Descrição completa da ficha criada para testar integridade.",
      gender: "Não informado",
      statusOptionId: status[0].id,
      classOptionId: characterClass[0].id,
      coverImageUrl: null,
      coverImageStorageKey: null,
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      primaryColor: "#e8792f",
      secondaryColor: "#66737d",
      startDate: null,
      attributes: LEGACY_CHARACTER_ATTRIBUTES,
    });
    expect(isValidCharacterAttributes(character.attributes)).toBe(true);
    const classWithBonus = await repositories.characterClassOptions.update(
      characterClass[0].id,
      {
        attributeBonuses: {
          ...EMPTY_CHARACTER_ATTRIBUTES,
          physical: 2,
        },
      },
    );
    expect(
      calculateEffectiveAttributes(
        character.attributes,
        classWithBonus?.attributeBonuses ?? EMPTY_CHARACTER_ATTRIBUTES,
      ).physical,
    ).toBe(4);
    await expect(
      repositories.characters.update(character.id, {
        attributes: {
          physical: 6,
          agility: 2,
          marksmanship: 0,
          perception: 0,
          technique: 0,
          control: 0,
        },
      }),
    ).rejects.toMatchObject({ field: "attributes" });
    await expect(
      repositories.characters.update(character.id, {
        attributes: {
          physical: 4,
          agility: 1,
          marksmanship: 1,
          perception: 0,
          technique: 0,
          control: 0,
        },
      }),
    ).rejects.toMatchObject({ field: "attributes" });
    await expect(
      repositories.characterClassOptions.update(characterClass[0].id, {
        attributeBonuses: {
          ...EMPTY_CHARACTER_ATTRIBUTES,
          physical: 6,
        },
      }),
    ).rejects.toMatchObject({ field: "attributeBonuses" });
    await expect(repositories.characterStatusOptions.delete(status[0].id)).rejects.toBeInstanceOf(RepositoryConflictError);
    await expect(repositories.characterClassOptions.delete(characterClass[0].id)).rejects.toBeInstanceOf(RepositoryConflictError);
  });

  it("faz exclusão em cascata de uma campanha", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const campaign = await repositories.campaigns.create(campaignInput("descartavel"));
    await repositories.campaignChapters.create({
      campaignId: campaign.id,
      title: "Temporário",
      slug: "temporario",
      shortDescription: "Capítulo temporário para exclusão.",
      description: "Capítulo temporário para exclusão em cascata.",
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      order: 1,
      status: "draft",
    });
    await repositories.campaignSessions.create({
      campaignId: campaign.id,
      sessionNumber: 1,
      title: "Sessão futura",
      status: "scheduled",
      scheduledAt: "2027-01-01T22:00:00.000Z",
      occurredAt: null,
      summary: "",
      description: "",
      events: "",
      consequences: "",
    });
    await repositories.campaigns.delete(campaign.id);
    expect(await repositories.campaigns.findById(campaign.id)).toBeNull();
    expect(await repositories.campaignChapters.listByCampaign(campaign.id)).toEqual([]);
    expect(await repositories.campaignSessions.listByCampaign(campaign.id)).toEqual([]);
  });

  it("remove relações de arquivo ao excluir ficha ou sessão", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const [campaign, player, statusOptions, classOptions] = await Promise.all([
      repositories.campaigns.findBySlug("operacao-neptune"),
      repositories.users.findByUsername("player"),
      repositories.characterStatusOptions.list(),
      repositories.characterClassOptions.list(),
    ]);
    expect(campaign && player && statusOptions[0] && classOptions[0]).toBeTruthy();
    if (!campaign || !player || !statusOptions[0] || !classOptions[0]) return;

    const character = await repositories.characters.create({
      campaignId: campaign.id,
      userId: player.id,
      name: "Operador de Relação",
      slug: "operador-relacao",
      shortDescription: "Ficha para testar relações de arquivos.",
      description: "Ficha temporária usada para testar relações de arquivos.",
      gender: "Não informado",
      statusOptionId: statusOptions[0].id,
      classOptionId: classOptions[0].id,
      coverImageUrl: null,
      coverImageStorageKey: null,
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      primaryColor: "#e8792f",
      secondaryColor: "#66737d",
      startDate: null,
      attributes: LEGACY_CHARACTER_ATTRIBUTES,
    });
    const campaignSession = await repositories.campaignSessions.create({
      campaignId: campaign.id,
      sessionNumber: 1,
      title: "Sessão de relação",
      status: "scheduled",
      scheduledAt: "2027-01-01T22:00:00.000Z",
      occurredAt: null,
      summary: "",
      description: "",
      events: "",
      consequences: "",
    });
    const file = await repositories.files.create({
      campaignId: campaign.id,
      name: "Anexo temporário",
      description: "",
      category: "other",
      visibility: "members",
      storageKey: null,
      mimeType: null,
      sizeBytes: null,
    });
    await repositories.fileRelations.create({
      fileId: file.id,
      relationType: "character",
      relationId: character.id,
    });
    await repositories.fileRelations.create({
      fileId: file.id,
      relationType: "session",
      relationId: campaignSession.id,
    });

    await repositories.characters.delete(character.id);
    expect(await repositories.fileRelations.listByFile(file.id)).toMatchObject([
      { relationType: "session", relationId: campaignSession.id },
    ]);
    await repositories.campaignSessions.delete(campaignSession.id);
    expect(await repositories.fileRelations.listByFile(file.id)).toEqual([]);
  });
});

describe("leitura da experiência", () => {
  it("lista apenas Neptune no seed e respeita membership pendente", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const reader = new LocalCampaignReadRepository(database);
    const [player, gameMaster] = await Promise.all([
      repositories.users.findByUsername("player"),
      repositories.users.findByUsername("gm"),
    ]);
    expect(player && gameMaster).toBeTruthy();
    if (!player || !gameMaster) return;
    expect(await reader.listCampaignCards()).toMatchObject([{ slug: "operacao-neptune" }]);
    expect(await reader.listCampaignCardsForUser(player.id)).toMatchObject([{ slug: "operacao-neptune" }]);

    const extra = await repositories.campaigns.create({
      ...campaignInput("fixture-extra"),
      gameMasterUserId: gameMaster.id,
    });
    await repositories.campaignMembers.create({
      campaignId: extra.id,
      userId: player.id,
      role: "player",
      status: "pending",
      joinedAt: "2026-08-23T13:00:00.000Z",
    });
    expect(await reader.listCampaignCardsForUser(player.id)).toHaveLength(1);
    await expect(reader.findCampaignAccessBySlug(extra.slug, player.id)).resolves.toMatchObject({
      membership: { status: "pending" },
    });
    expect(await reader.listCampaignCardsForUser(gameMaster.id)).toHaveLength(2);
  });

  it("agrega O Prólogo, opções de ficha e zero sessões", async () => {
    const { database } = await createTestDatabase();
    const reader = new LocalCampaignReadRepository(database);
    const neptune = await reader.findCampaignExperienceBySlug("operacao-neptune");
    expect(neptune).not.toBeNull();
    expect(neptune?.gameMaster?.username).toBe("gm");
    expect(neptune?.chapters.map((chapter) => chapter.title)).toEqual(["O Prólogo"]);
    expect(neptune?.characterStatusOptions.length).toBeGreaterThan(0);
    expect(neptune?.characterClassOptions.length).toBeGreaterThan(0);
    expect(neptune?.characters).toEqual([]);
    expect(neptune?.sessions).toEqual([]);
    expect(neptune?.events).toEqual([]);
  });
});

describe("armazenamento local de imagens", () => {
  it("grava, lê e remove uma imagem com chave opaca", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "rpg-vitin-upload-"));
    temporaryDirectories.push(directory);
    const provider = new LocalFileStorageProvider({ rootPath: directory });
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const stored = await provider.store({
      campaignId: "10000000-0000-4000-8000-000000000001",
      originalName: "../../capa.png",
      mimeType: "image/png",
      bytes,
    });
    expect(stored.key).toMatch(/^[a-zA-Z0-9-]+\/[a-f0-9-]+\.png$/);
    expect(await provider.getDownloadUrl(stored.key)).toMatch(/^\/media\//);
    expect((await provider.read(stored.key))?.bytes).toEqual(bytes);
    await provider.remove(stored.key);
    expect(await provider.read(stored.key)).toBeNull();
  });

  it("recusa MIME, assinatura e caminhos inválidos", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "rpg-vitin-upload-"));
    temporaryDirectories.push(directory);
    const provider = new LocalFileStorageProvider({ rootPath: directory });
    await expect(
      provider.store({
        campaignId: "campaign",
        originalName: "vetor.svg",
        mimeType: "image/svg+xml",
        bytes: Uint8Array.from([1, 2, 3]),
      }),
    ).rejects.toBeInstanceOf(InvalidStoredFileError);
    await expect(
      provider.store({
        campaignId: "campaign",
        originalName: "falsa.png",
        mimeType: "image/png",
        bytes: Uint8Array.from([1, 2, 3, 4]),
      }),
    ).rejects.toBeInstanceOf(InvalidStoredFileError);
    expect(await provider.read("../segredo.png")).toBeNull();
    await expect(provider.getDownloadUrl("../segredo.png")).rejects.toBeInstanceOf(InvalidStoredFileError);
  });
});

describe("autorização de mídia", () => {
  it("separa arte pública, conteúdo de membro, rascunho e arquivo órfão", async () => {
    const { database } = await createTestDatabase();
    const snapshot = await database.read();
    const campaignBase = snapshot.campaigns[0];
    const chapterBase = snapshot.campaignChapters[0];
    const classBase = snapshot.characterClassOptions[0];
    const admin = snapshot.users.find((user) => user.role === "admin");
    const player = snapshot.users.find((user) => user.role === "player");
    expect(campaignBase && chapterBase && classBase && admin && player).toBeTruthy();
    if (!campaignBase || !chapterBase || !classBase || !admin || !player) return;
    const membership = snapshot.campaignMembers.find(
      (item) => item.campaignId === campaignBase.id && item.userId === player.id,
    ) ?? null;
    const campaign = {
      ...campaignBase,
      coverImageStorageKey: `${campaignBase.id}/public.png`,
    };
    const chapters = [
      {
        ...chapterBase,
        backgroundImageStorageKey: `${campaign.id}/published.png`,
      },
      {
        ...chapterBase,
        id: "20000000-0000-4000-8000-000000000099",
        slug: "rascunho",
        status: "draft" as const,
        backgroundImageStorageKey: `${campaign.id}/draft.png`,
      },
      {
        ...chapterBase,
        id: "20000000-0000-4000-8000-000000000100",
        title: "Capítulo futuro",
        slug: "capitulo-futuro",
        order: 2,
        backgroundImageStorageKey: `${campaign.id}/locked.png`,
      },
    ];
    const classOptions = [
      {
        ...classBase,
        logoImageUrl: `/media/${campaign.id}/class-logo.png`,
        logoImageStorageKey: `${campaign.id}/class-logo.png`,
      },
    ];
    const classify = (storageKey: string) =>
      classifyCampaignMediaReference({
        storageKey,
        campaign,
        chapters,
        characters: [],
        classOptions,
        files: [],
      });

    expect(canReadCampaignMedia(classify(`${campaign.id}/public.png`), campaign, null, null)).toBe(true);
    expect(canReadCampaignMedia(classify(`${campaign.id}/published.png`), campaign, null, null)).toBe(false);
    expect(canReadCampaignMedia(classify(`${campaign.id}/published.png`), campaign, player, membership)).toBe(true);
    expect(canReadCampaignMedia(classify(`${campaign.id}/draft.png`), campaign, player, membership)).toBe(false);
    expect(canReadCampaignMedia(classify(`${campaign.id}/draft.png`), campaign, admin, null)).toBe(true);
    expect(canReadCampaignMedia(classify(`${campaign.id}/locked.png`), campaign, player, membership)).toBe(false);
    expect(canReadCampaignMedia(classify(`${campaign.id}/locked.png`), campaign, admin, null)).toBe(true);
    expect(canReadCampaignMedia(classify(`${campaign.id}/class-logo.png`), campaign, null, null)).toBe(false);
    expect(canReadCampaignMedia(classify(`${campaign.id}/class-logo.png`), campaign, player, membership)).toBe(true);
    expect(classify(`${campaign.id}/orphan.png`)).toEqual({ kind: "unknown" });
  });
});

describe("políticas de acesso", () => {
  it("distingue admin, mestre autorizado e jogador", async () => {
    const { database } = await createTestDatabase();
    const repositories = createLocalRepositories(database);
    const [admin, gameMaster, player, campaign] = await Promise.all([
      repositories.users.findByUsername("admin"),
      repositories.users.findByUsername("gm"),
      repositories.users.findByUsername("player"),
      repositories.campaigns.findBySlug("operacao-neptune"),
    ]);
    expect(admin && gameMaster && player && campaign).toBeTruthy();
    if (!admin || !gameMaster || !player || !campaign) return;
    const [gmMembership, playerMembership] = await Promise.all([
      repositories.campaignMembers.findMembership(campaign.id, gameMaster.id),
      repositories.campaignMembers.findMembership(campaign.id, player.id),
    ]);
    expect(canManageCampaign(admin, campaign, null)).toBe(true);
    expect(canManageCampaign(gameMaster, campaign, gmMembership)).toBe(true);
    expect(canManageCampaign(player, campaign, playerMembership)).toBe(false);
    expect(canViewCampaign(admin, campaign, null)).toBe(true);
    expect(canViewCampaign(gameMaster, campaign, gmMembership)).toBe(true);
    expect(canViewCampaign(player, campaign, playerMembership)).toBe(true);
    expect(canViewContent("members", player, playerMembership)).toBe(true);
    expect(canViewContent("game_master", player, playerMembership)).toBe(false);
  });
});
