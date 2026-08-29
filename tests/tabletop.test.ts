import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseDiceExpression, rollParsedDice } from "@/domain/dice";
import { LEGACY_CHARACTER_ATTRIBUTES } from "@/domain/character-attributes";
import { canControlVirtualTableToken } from "@/domain/permissions";
import { RepositoryConflictError } from "@/domain/repositories";
import { JsonDatabase } from "@/infrastructure/local/json-database";
import { LocalFileStorageProvider } from "@/infrastructure/local/local-file-storage-provider";
import { createLocalRepositories } from "@/infrastructure/local/local-repositories";
import { LocalTabletopReadRepository } from "@/infrastructure/local/local-tabletop-read-repository";

const temporaryDirectories: string[] = [];

async function createTestDatabase() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rpg-tabletop-test-"));
  temporaryDirectories.push(directory);
  const database = new JsonDatabase({
    filePath: path.join(directory, "database.json"),
    seedPath: path.join(process.cwd(), "data", "seed.json"),
  });
  return { directory, database };
}

async function createOpenTableFixture() {
  const { directory, database } = await createTestDatabase();
  const repositories = createLocalRepositories(database);
  const [campaign, gameMaster, player, admin, statuses, classes] =
    await Promise.all([
      repositories.campaigns.findBySlug("operacao-neptune"),
      repositories.users.findByUsername("gm"),
      repositories.users.findByUsername("player"),
      repositories.users.findByUsername("admin"),
      repositories.characterStatusOptions.list(),
      repositories.characterClassOptions.list(),
    ]);

  if (
    !campaign ||
    !gameMaster ||
    !player ||
    !admin ||
    !statuses[0] ||
    !classes[0]
  ) {
    throw new Error("O seed de teste não contém a estrutura esperada.");
  }

  const campaignSession = await repositories.campaignSessions.create({
    campaignId: campaign.id,
    sessionNumber: 1,
    title: "Primeira incursão",
    status: "scheduled",
    scheduledAt: "2027-01-01T22:00:00.000Z",
    occurredAt: null,
    summary: "",
    description: "",
    events: "",
    consequences: "",
  });
  const character = await repositories.characters.create({
    campaignId: campaign.id,
    userId: player.id,
    name: "Operador do jogador",
    slug: "operador-do-jogador",
    shortDescription: "Personagem controlado pelo jogador no teste da mesa.",
    description:
      "Ficha criada exclusivamente para validar controle e sincronização de tokens.",
    gender: "Não informado",
    statusOptionId: statuses[0].id,
    classOptionId: classes[0].id,
    coverImageUrl: null,
    coverImageStorageKey: null,
    backgroundImageUrl: null,
    backgroundImageStorageKey: null,
    primaryColor: "#e8792f",
    secondaryColor: "#66737d",
    startDate: null,
    attributes: LEGACY_CHARACTER_ATTRIBUTES,
  });
  const table = await repositories.tabletop.open({
    campaignId: campaign.id,
    sessionId: campaignSession.id,
    openedByUserId: gameMaster.id,
  });
  const [gameMasterMembership, playerMembership] = await Promise.all([
    repositories.campaignMembers.findMembership(campaign.id, gameMaster.id),
    repositories.campaignMembers.findMembership(campaign.id, player.id),
  ]);

  return {
    directory,
    database,
    repositories,
    campaign,
    campaignSession,
    table,
    gameMaster,
    gameMasterMembership,
    player,
    playerMembership,
    admin,
    character,
    statusOptionId: statuses[0].id,
    classOptionId: classes[0].id,
  };
}

afterEach(async () => {
  const directories = temporaryDirectories.splice(0);
  await Promise.all(
    directories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("expressões e rolagens de dados", () => {
  it("normaliza todos os dados permitidos e recusa comandos fora dos limites", () => {
    expect(parseDiceExpression("d4")).toMatchObject({
      count: 1,
      sides: 4,
      modifier: 0,
      expression: "1d4",
    });
    expect(parseDiceExpression(" 2D6 + 3 ")).toEqual({
      count: 2,
      sides: 6,
      modifier: 3,
      expression: "2d6+3",
    });
    expect(
      [4, 6, 8, 10, 12, 20, 100].map(
        (sides) => parseDiceExpression(`1d${sides}`)?.sides,
      ),
    ).toEqual([4, 6, 8, 10, 12, 20, 100]);

    for (const invalid of [
      "0d20",
      "21d6",
      "1d3",
      "2d6+101",
      "2d6-101",
      "1d20+texto",
      "1d20+1d4",
      "",
    ]) {
      expect(parseDiceExpression(invalid), invalid).toBeNull();
    }
  });

  it("calcula uma rolagem determinística e protege o intervalo do dado", () => {
    const parsed = parseDiceExpression("2d6+3");
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const deterministicValues = [6, 2];
    const sidesReceived: number[] = [];
    const result = rollParsedDice(parsed, (sides) => {
      sidesReceived.push(sides);
      return deterministicValues.shift() ?? 1;
    });

    expect(sidesReceived).toEqual([6, 6]);
    expect(result).toMatchObject({
      expression: "2d6+3",
      diceValues: [6, 2],
      modifier: 3,
      total: 11,
    });
    expect(() => rollParsedDice(parsed, () => 0)).toThrow(
      "DICE_ROLL_OUT_OF_RANGE",
    );
    expect(() => rollParsedDice(parsed, () => 7)).toThrow(
      "DICE_ROLL_OUT_OF_RANGE",
    );
  });
});

describe("permissões de tokens", () => {
  it("permite ao mestre controlar tudo e ao jogador somente o próprio personagem", async () => {
    const fixture = await createOpenTableFixture();
    const ownToken = (
      await fixture.repositories.tabletop.createToken({
        tableId: fixture.table.id,
        name: fixture.character.name,
        kind: "character",
        characterId: fixture.character.id,
        imageFileId: null,
        x: 0.25,
        y: 0.3,
        size: 0.055,
        zIndex: 1,
        visible: true,
      })
    ).token;
    const npcToken = (
      await fixture.repositories.tabletop.createToken({
        tableId: fixture.table.id,
        name: "Contato local",
        kind: "npc",
        characterId: null,
        imageFileId: null,
        x: 0.6,
        y: 0.55,
        size: 0.055,
        zIndex: 2,
        visible: true,
      })
    ).token;
    const otherCharacter = await fixture.repositories.characters.create({
      campaignId: fixture.campaign.id,
      userId: fixture.gameMaster.id,
      name: "Operador de apoio",
      slug: "operador-de-apoio",
      shortDescription: "Personagem pertencente a outro usuário da campanha.",
      description: "Personagem usado para validar isolamento de controle entre usuários.",
      gender: "Não informado",
      statusOptionId: fixture.statusOptionId,
      classOptionId: fixture.classOptionId,
      coverImageUrl: null,
      coverImageStorageKey: null,
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      primaryColor: "#e8792f",
      secondaryColor: "#66737d",
      startDate: null,
      attributes: LEGACY_CHARACTER_ATTRIBUTES,
    });
    const otherToken = (
      await fixture.repositories.tabletop.createToken({
        tableId: fixture.table.id,
        name: otherCharacter.name,
        kind: "character",
        characterId: otherCharacter.id,
        imageFileId: null,
        x: 0.7,
        y: 0.4,
        size: 0.055,
        zIndex: 3,
        visible: true,
      })
    ).token;

    expect(
      canControlVirtualTableToken(
        fixture.player,
        fixture.campaign,
        fixture.playerMembership,
        ownToken,
        fixture.character,
      ),
    ).toBe(true);
    expect(
      canControlVirtualTableToken(
        fixture.player,
        fixture.campaign,
        fixture.playerMembership,
        { ...ownToken, visible: false },
        fixture.character,
      ),
    ).toBe(false);
    expect(
      canControlVirtualTableToken(
        fixture.player,
        fixture.campaign,
        fixture.playerMembership,
        npcToken,
        null,
      ),
    ).toBe(false);
    expect(
      canControlVirtualTableToken(
        fixture.player,
        fixture.campaign,
        fixture.playerMembership,
        otherToken,
        otherCharacter,
      ),
    ).toBe(false);
    expect(
      canControlVirtualTableToken(
        fixture.gameMaster,
        fixture.campaign,
        fixture.gameMasterMembership,
        npcToken,
        null,
      ),
    ).toBe(true);
    expect(
      canControlVirtualTableToken(
        fixture.admin,
        fixture.campaign,
        null,
        otherToken,
        otherCharacter,
      ),
    ).toBe(true);
    expect(
      canControlVirtualTableToken(
        fixture.player,
        fixture.campaign,
        fixture.playerMembership
          ? { ...fixture.playerMembership, status: "pending" }
          : null,
        ownToken,
        fixture.character,
      ),
    ).toBe(false);
  });
});

describe("repositório da mesa virtual", () => {
  it("impede que o admin pule o capítulo ativo por edição enquanto a mesa está aberta", async () => {
    const fixture = await createOpenTableFixture();
    const chapters = await fixture.repositories.campaignChapters.listByCampaign(
      fixture.campaign.id,
    );
    const prologue = chapters[0];
    expect(prologue?.title).toBe("O Prólogo");
    if (!prologue) return;

    const futureChapter = await fixture.repositories.campaignChapters.create({
      campaignId: fixture.campaign.id,
      title: "Missão Suicida",
      slug: "missao-suicida-progressao",
      shortDescription: "A equipe deixa o heliporto rumo ao alvo.",
      description:
        "Capítulo futuro usado para validar que a administração não consegue furar a progressão da mesa.",
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      order: 2,
      status: "published",
    });

    await expect(
      fixture.repositories.campaignChapters.update(futureChapter.id, {
        order: 1,
      }),
    ).rejects.toMatchObject({ field: "progression" });
    await expect(
      fixture.repositories.campaignChapters.update(prologue.id, {
        status: "draft",
      }),
    ).rejects.toMatchObject({ field: "progression" });
    await expect(
      fixture.repositories.campaignChapters.delete(prologue.id),
    ).rejects.toMatchObject({ field: "progression" });

    const edited = await fixture.repositories.campaignChapters.update(
      prologue.id,
      {
        description:
          "A descrição narrativa continua editável sem alterar a etapa ativa.",
      },
    );
    expect(edited?.description).toContain("continua editável");

    const persisted =
      await fixture.repositories.campaignChapters.listByCampaign(
        fixture.campaign.id,
      );
    expect(persisted[0]).toMatchObject({
      id: prologue.id,
      status: "published",
      order: prologue.order,
    });
    expect(persisted[1]).toMatchObject({
      id: futureChapter.id,
      order: 2,
    });
  });

  it("conclui o capítulo atual, desbloqueia o próximo e troca o mapa atomicamente", async () => {
    const fixture = await createOpenTableFixture();
    const chapters = await fixture.repositories.campaignChapters.listByCampaign(
      fixture.campaign.id,
    );
    const prologue = chapters[0];
    expect(prologue?.title).toBe("O Prólogo");
    if (!prologue) return;

    const nextChapter = await fixture.repositories.campaignChapters.create({
      campaignId: fixture.campaign.id,
      title: "Missão Suicida",
      slug: "missao-suicida",
      shortDescription: "A equipe deixa o heliporto rumo ao alvo.",
      description:
        "O próximo estágio da operação começa na zona de inserção e permanece bloqueado até o prólogo terminar.",
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      order: 2,
      status: "published",
    });
    const maps = await fixture.repositories.tabletop.listMapsByCampaign(
      fixture.campaign.id,
    );
    const helipad = maps.find((map) => map.order === 30);
    const insertionZone = maps.find((map) => map.order === 40);
    expect(helipad && insertionZone).toBeTruthy();
    if (!helipad || !insertionZone) return;
    const atHelipad = await fixture.repositories.tabletop.activateMap(
      fixture.table.id,
      helipad.id,
    );
    expect(atHelipad?.table.activeMapId).toBe(helipad.id);

    const reader = new LocalTabletopReadRepository(
      fixture.database,
      new LocalFileStorageProvider({
        rootPath: path.join(fixture.directory, "uploads"),
      }),
    );
    const playerBefore = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      {
        includeHiddenTokens: false,
        includeLockedChapterDetails: false,
      },
    );
    const masterBefore = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      {
        includeHiddenTokens: true,
        includeLockedChapterDetails: true,
      },
    );
    expect(playerBefore?.chapterProgress).toMatchObject({
      current: { id: prologue.id, title: "O Prólogo", order: 1 },
      next: null,
      hasNext: true,
      completedCount: 0,
      total: 2,
    });
    expect(masterBefore?.chapterProgress.next).toMatchObject({
      id: nextChapter.id,
      title: "Missão Suicida",
      order: 2,
    });

    const completedAt = "2027-01-01T23:15:00.000Z";
    const advanced = await fixture.repositories.tabletop.advanceChapter({
      tableId: fixture.table.id,
      currentChapterId: prologue.id,
      nextChapterId: nextChapter.id,
      mapId: insertionZone.id,
      requestedByUserId: fixture.gameMaster.id,
      completedAt,
    });

    expect(advanced).toMatchObject({
      completedChapter: { id: prologue.id, completedAt },
      nextChapter: { id: nextChapter.id, completedAt: null },
      map: { id: insertionZone.id },
      table: {
        activeMapId: insertionZone.id,
        revision: (atHelipad?.table.revision ?? 0) + 1,
        lastChapterTransition: {
          fromChapterId: prologue.id,
          toChapterId: nextChapter.id,
          mapId: insertionZone.id,
          occurredAt: completedAt,
        },
      },
    });
    const playerAfter = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      {
        includeHiddenTokens: false,
        includeLockedChapterDetails: false,
      },
    );
    expect(playerAfter?.chapterProgress).toMatchObject({
      current: { id: nextChapter.id, title: "Missão Suicida", order: 2 },
      next: null,
      hasNext: false,
      completedCount: 1,
      total: 2,
      transition: {
        from: { id: prologue.id },
        to: { id: nextChapter.id },
        mapName: insertionZone.name,
      },
    });
    expect(playerAfter?.table).toMatchObject({
      activeMapId: insertionZone.id,
      mapName: insertionZone.name,
    });

    await expect(
      fixture.repositories.tabletop.advanceChapter({
        tableId: fixture.table.id,
        currentChapterId: prologue.id,
        nextChapterId: nextChapter.id,
        mapId: helipad.id,
        requestedByUserId: fixture.gameMaster.id,
        completedAt: "2027-01-01T23:16:00.000Z",
      }),
    ).rejects.toMatchObject({ field: "chapter" });
    expect(
      (await fixture.repositories.tabletop.findById(fixture.table.id))
        ?.activeMapId,
    ).toBe(insertionZone.id);

    await expect(
      fixture.repositories.tabletop.advanceChapter({
        tableId: fixture.table.id,
        currentChapterId: nextChapter.id,
        nextChapterId: prologue.id,
        mapId: null,
        requestedByUserId: fixture.gameMaster.id,
        completedAt: "2027-01-01T23:18:00.000Z",
      }),
    ).rejects.toMatchObject({ field: "chapter" });

    await expect(
      fixture.repositories.tabletop.advanceChapter({
        tableId: fixture.table.id,
        currentChapterId: nextChapter.id,
        nextChapterId: null,
        mapId: null,
        requestedByUserId: fixture.player.id,
        completedAt: "2027-01-01T23:20:00.000Z",
      }),
    ).rejects.toMatchObject({ field: "authorization" });

    const finalCompletion = await fixture.repositories.tabletop.advanceChapter({
      tableId: fixture.table.id,
      currentChapterId: nextChapter.id,
      nextChapterId: null,
      mapId: null,
      requestedByUserId: fixture.gameMaster.id,
      completedAt: "2027-01-01T23:25:00.000Z",
    });
    expect(finalCompletion).toMatchObject({
      nextChapter: null,
      map: null,
      table: {
        activeMapId: insertionZone.id,
        lastChapterTransition: {
          fromChapterId: nextChapter.id,
          toChapterId: null,
          mapId: insertionZone.id,
        },
      },
    });
    const completedSnapshot = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      {
        includeHiddenTokens: false,
        includeLockedChapterDetails: false,
      },
    );
    expect(completedSnapshot?.chapterProgress).toMatchObject({
      previous: { id: nextChapter.id },
      current: null,
      next: null,
      hasNext: false,
      completedCount: 2,
      total: 2,
      transition: {
        from: { id: nextChapter.id },
        to: null,
      },
    });
  });

  it("volta ao capítulo anterior e preserva o mapa e os tokens preparados", async () => {
    const fixture = await createOpenTableFixture();
    const [prologue] =
      await fixture.repositories.campaignChapters.listByCampaign(
        fixture.campaign.id,
      );
    if (!prologue) return;
    const nextChapter = await fixture.repositories.campaignChapters.create({
      campaignId: fixture.campaign.id,
      title: "Missão Suicida",
      slug: "missao-suicida-retorno",
      shortDescription: "A equipe avança para a zona de inserção.",
      description: "Capítulo usado para validar o retorno seguro do mestre.",
      backgroundImageUrl: null,
      backgroundImageStorageKey: null,
      order: 2,
      status: "published",
    });
    const maps = await fixture.repositories.tabletop.listMapsByCampaign(
      fixture.campaign.id,
    );
    const insertionZone = maps.find((map) => map.order === 40);
    expect(insertionZone).toBeTruthy();
    if (!insertionZone) return;

    await expect(
      fixture.repositories.tabletop.rollbackChapter({
        tableId: fixture.table.id,
        currentChapterId: prologue.id,
        previousChapterId: nextChapter.id,
        requestedByUserId: fixture.gameMaster.id,
        occurredAt: "2027-01-02T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ field: "chapter" });

    const advanced = await fixture.repositories.tabletop.advanceChapter({
      tableId: fixture.table.id,
      currentChapterId: prologue.id,
      nextChapterId: nextChapter.id,
      mapId: insertionZone.id,
      requestedByUserId: fixture.gameMaster.id,
      completedAt: "2027-01-02T00:05:00.000Z",
    });
    const npc = (
      await fixture.repositories.tabletop.createToken({
        tableId: fixture.table.id,
        name: "Sentinela preparado",
        kind: "npc",
        characterId: null,
        imageFileId: null,
        x: 0.42,
        y: 0.38,
        size: 0.02,
        zIndex: 1,
        visible: true,
      })
    ).token;
    const beforeRollback = await fixture.repositories.tabletop.findById(
      fixture.table.id,
    );

    await expect(
      fixture.repositories.tabletop.rollbackChapter({
        tableId: fixture.table.id,
        currentChapterId: nextChapter.id,
        previousChapterId: prologue.id,
        requestedByUserId: fixture.player.id,
        occurredAt: "2027-01-02T00:09:00.000Z",
      }),
    ).rejects.toMatchObject({ field: "authorization" });

    const occurredAt = "2027-01-02T00:10:00.000Z";
    const rolledBack = await fixture.repositories.tabletop.rollbackChapter({
      tableId: fixture.table.id,
      currentChapterId: nextChapter.id,
      previousChapterId: prologue.id,
      requestedByUserId: fixture.gameMaster.id,
      occurredAt,
    });
    expect(rolledBack).toMatchObject({
      restoredChapter: { id: prologue.id, completedAt: null },
      formerCurrentChapter: { id: nextChapter.id, completedAt: null },
      table: {
        activeMapId: insertionZone.id,
        revision: (beforeRollback?.revision ?? 0) + 1,
        lastChapterTransition: {
          fromChapterId: nextChapter.id,
          toChapterId: prologue.id,
          mapId: insertionZone.id,
          occurredAt,
        },
      },
    });
    expect(advanced?.table.activeMapId).toBe(insertionZone.id);
    expect(
      (await fixture.repositories.tabletop.findTokenById(npc.id))?.mapId,
    ).toBe(insertionZone.id);

    const reader = new LocalTabletopReadRepository(
      fixture.database,
      new LocalFileStorageProvider({
        rootPath: path.join(fixture.directory, "uploads"),
      }),
    );
    const masterSnapshot = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      { includeHiddenTokens: true, includeLockedChapterDetails: true },
    );
    const playerSnapshot = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      { includeHiddenTokens: false, includeLockedChapterDetails: false },
    );
    expect(masterSnapshot?.chapterProgress).toMatchObject({
      previous: null,
      current: { id: prologue.id },
      next: { id: nextChapter.id },
      completedCount: 0,
      transition: {
        from: { id: nextChapter.id },
        to: { id: prologue.id },
      },
    });
    expect(playerSnapshot?.chapterProgress).toMatchObject({
      previous: null,
      current: { id: prologue.id },
      next: null,
      hasNext: true,
      completedCount: 0,
    });
    expect(playerSnapshot?.tokens).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: npc.id })]),
    );
  });

  it("mantém uma biblioteca de mapas por campanha e troca camadas sem perder uploads", async () => {
    const fixture = await createOpenTableFixture();
    const builtInMaps = await fixture.repositories.tabletop.listMapsByCampaign(
      fixture.campaign.id,
    );
    expect(builtInMaps).toHaveLength(18);
    expect(fixture.table.activeMapId).toBe(builtInMaps[0]?.id);
    expect(builtInMaps.slice(0, 3).map((map) => map.layerName)).toEqual([
      "Convés principal",
      "Convés superior",
      "Nível inferior",
    ]);

    const mapFile = await fixture.repositories.files.create({
      campaignId: fixture.campaign.id,
      createdByUserId: fixture.gameMaster.id,
      name: "Mapa importado",
      description: "",
      category: "map",
      visibility: "members",
      storageKey: "table-tests/library-map.png",
      mimeType: "image/png",
      sizeBytes: 256,
    });
    const customMap = await fixture.repositories.tabletop.createMap({
      campaignId: fixture.campaign.id,
      name: "Anexo de treinamento",
      description: "Mapa personalizado",
      groupName: "Base dos SEALs",
      layerName: "Anexo",
      imageFileId: mapFile.id,
      builtInImageUrl: null,
      scale: "large",
      builtIn: false,
      order: 40,
      createdByUserId: fixture.gameMaster.id,
    });
    const activated = await fixture.repositories.tabletop.activateMap(
      fixture.table.id,
      customMap.id,
    );
    expect(activated?.table).toMatchObject({
      activeMapId: customMap.id,
      revision: fixture.table.revision + 1,
    });

    const mapToken = (
      await fixture.repositories.tabletop.createToken({
        tableId: fixture.table.id,
        name: "Instrutor no anexo",
        kind: "npc",
        characterId: null,
        imageFileId: null,
        x: 0.5,
        y: 0.5,
        size: 0.055,
        zIndex: 1,
        visible: true,
      })
    ).token;
    expect(mapToken.mapId).toBe(customMap.id);
    await expect(
      fixture.repositories.tabletop.deleteMap(customMap.id),
    ).rejects.toMatchObject({
      field: "mapId",
      message: expect.stringContaining("Mova-os para outra camada"),
    });
    await fixture.repositories.tabletop.updateToken(
      fixture.table.id,
      mapToken.id,
      { mapId: builtInMaps[0]!.id },
    );

    const deletion = await fixture.repositories.tabletop.deleteMap(customMap.id);
    expect(deletion).toEqual({ deleted: true, fileId: mapFile.id });
    expect(
      (await fixture.repositories.tabletop.findById(fixture.table.id))?.activeMapId,
    ).toBe(builtInMaps[0]?.id);
    await expect(
      fixture.repositories.tabletop.deleteMap(builtInMaps[0]!.id),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
  });

  it("persiste personalização, cone de visão e inventário no snapshot", async () => {
    const fixture = await createOpenTableFixture();
    const created = await fixture.repositories.tabletop.createToken({
      tableId: fixture.table.id,
      name: "Contato",
      kind: "npc",
      characterId: null,
      imageFileId: null,
      x: 0.4,
      y: 0.45,
      size: 0.0125,
      zIndex: 1,
      visible: true,
    });
    const customized = await fixture.repositories.tabletop.updateToken(
      fixture.table.id,
      created.token.id,
      {
        name: "Contato aliado",
        disposition: "ally",
        accentColor: "#38bdf8",
        notes: "Possui a chave do depósito.",
        collectible: false,
        rotation: 135,
        visionEnabled: true,
        visionAngle: 90,
        visionRange: 0.35,
        visionColor: "#67e8f9",
      },
    );
    expect(customized?.token).toMatchObject({
      name: "Contato aliado",
      disposition: "ally",
      size: 0.0125,
      rotation: 135,
      visionAngle: 90,
      visionRange: 0.35,
    });
    await fixture.repositories.characters.update(fixture.character.id, {
      equipment: ["M4A1", "Colete balístico"],
      wounds: ["Escoriação no braço"],
      backpackItems: ["Kit médico", "Documento interceptado"],
      inventorySlots: 10,
    });

    const reader = new LocalTabletopReadRepository(
      fixture.database,
      new LocalFileStorageProvider({
        rootPath: path.join(fixture.directory, "uploads"),
      }),
    );
    const snapshot = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      { includeHiddenTokens: true },
    );
    expect(snapshot?.maps).toHaveLength(18);
    expect(snapshot?.table.activeMapId).toBe(snapshot?.maps[0]?.id);
    expect(snapshot?.tokens[0]).toMatchObject({
      accentColor: "#38bdf8",
      size: 0.0125,
      notes: "Possui a chave do depósito.",
      visionEnabled: true,
      visionColor: "#67e8f9",
    });
    expect(snapshot?.characters[0]).toMatchObject({
      equipment: ["M4A1", "Colete balístico"],
      wounds: ["Escoriação no braço"],
      backpackItems: ["Kit médico", "Documento interceptado"],
      inventorySlots: 10,
    });
    await expect(
      fixture.repositories.tabletop.updateToken(
        fixture.table.id,
        created.token.id,
        { size: 0.009 },
      ),
    ).rejects.toMatchObject({ field: "size" });

    const layers = await fixture.repositories.tabletop.listMapsByCampaign(
      fixture.campaign.id,
    );
    await fixture.repositories.tabletop.activateMap(
      fixture.table.id,
      layers[1]!.id,
    );
    const upperDeckBeforeTransfer =
      await reader.findOpenSnapshotByCampaignSlug(fixture.campaign.slug, {
        includeHiddenTokens: true,
      });
    expect(upperDeckBeforeTransfer?.tokens).toEqual([]);

    await fixture.repositories.tabletop.updateToken(
      fixture.table.id,
      created.token.id,
      { mapId: layers[1]!.id },
    );
    const upperDeckAfterTransfer =
      await reader.findOpenSnapshotByCampaignSlug(fixture.campaign.slug, {
        includeHiddenTokens: true,
      });
    expect(upperDeckAfterTransfer?.tokens).toMatchObject([
      {
        id: created.token.id,
        mapId: layers[1]!.id,
        name: "Contato aliado",
      },
    ]);
  });

  it("cria várias cópias de um token compartilhando a mesma imagem", async () => {
    const fixture = await createOpenTableFixture();
    const image = await fixture.repositories.files.create({
      campaignId: fixture.campaign.id,
      createdByUserId: fixture.gameMaster.id,
      name: "Guarda do lote",
      description: "Imagem compartilhada pelas cópias.",
      category: "image",
      visibility: "members",
      storageKey: "table-tests/guard-batch.png",
      mimeType: "image/png",
      sizeBytes: 512,
    });
    const result = await fixture.repositories.tabletop.createTokens(
      Array.from({ length: 5 }, (_, index) => ({
        tableId: fixture.table.id,
        mapId: fixture.table.activeMapId,
        name: `Guarda ${String(index + 1).padStart(2, "0")}`,
        kind: "npc" as const,
        characterId: null,
        imageFileId: image.id,
        x: 0.34 + index * 0.07,
        y: 0.42,
        size: 0.04,
        zIndex: index + 1,
        visible: true,
        disposition: "hostile" as const,
        accentColor: "#ef4444",
        notes: "Patrulha inimiga.",
        collectible: false,
        rotation: 0,
        visionEnabled: true,
        visionAngle: 70,
        visionRange: 0.18,
        visionColor: "#ef4444",
      })),
    );

    expect(result.tokens).toHaveLength(5);
    expect(result.tokens.map((token) => token.name)).toEqual([
      "Guarda 01",
      "Guarda 02",
      "Guarda 03",
      "Guarda 04",
      "Guarda 05",
    ]);
    expect(new Set(result.tokens.map((token) => token.imageFileId))).toEqual(
      new Set([image.id]),
    );
    expect(new Set(result.tokens.map((token) => token.id)).size).toBe(5);
    expect(
      new Set(result.tokens.map((token) => `${token.x}:${token.y}`)).size,
    ).toBe(5);
    expect(result.tokens.map((token) => token.zIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(result.table.revision).toBe(fixture.table.revision + 5);
    expect(
      await fixture.repositories.tabletop.listTokens(fixture.table.id),
    ).toHaveLength(5);
  });

  it("cancela o lote inteiro quando uma das cópias é inválida", async () => {
    const fixture = await createOpenTableFixture();
    const characterToken = {
      tableId: fixture.table.id,
      mapId: fixture.table.activeMapId,
      name: "Operador duplicado",
      kind: "character" as const,
      characterId: fixture.character.id,
      imageFileId: null,
      x: 0.4,
      y: 0.45,
      size: 0.04,
      zIndex: 1,
      visible: true,
      disposition: "player" as const,
      accentColor: "#38bdf8",
      notes: "",
      collectible: false,
      rotation: 0,
      visionEnabled: true,
      visionAngle: 70,
      visionRange: 0.18,
      visionColor: "#38bdf8",
    };

    await expect(
      fixture.repositories.tabletop.createTokens([
        characterToken,
        { ...characterToken, name: "Segunda cópia", zIndex: 2, x: 0.5 },
      ]),
    ).rejects.toMatchObject({ field: "characterId" });

    expect(
      await fixture.repositories.tabletop.listTokens(fixture.table.id),
    ).toEqual([]);
    expect(
      (await fixture.repositories.tabletop.findById(fixture.table.id))?.revision,
    ).toBe(fixture.table.revision);
  });

  it("encerra a mesa de forma atômica e idempotente", async () => {
    const fixture = await createOpenTableFixture();
    const occurredAt = "2027-01-01T23:50:00.000Z";

    const first = await fixture.repositories.campaignSessions.completeTableSession(
      fixture.table.id,
      occurredAt,
    );
    const repeated =
      await fixture.repositories.campaignSessions.completeTableSession(
        fixture.table.id,
        "2027-01-02T00:10:00.000Z",
      );

    expect(first).not.toBeNull();
    expect(first?.session).toMatchObject({ status: "completed", occurredAt });
    expect(first?.table).toMatchObject({ status: "closed", revision: 2 });
    expect(repeated).toEqual(first);
  });

  it("conclui a sessão e fecha sua mesa na mesma mutação", async () => {
    const fixture = await createOpenTableFixture();
    const occurredAt = "2027-01-01T23:45:00.000Z";

    const lifecycle =
      await fixture.repositories.campaignSessions.updateAndCloseTable(
        fixture.campaignSession.id,
        { status: "completed", occurredAt },
      );

    expect(lifecycle?.session).toMatchObject({ status: "completed", occurredAt });
    expect(lifecycle?.table).toMatchObject({
      id: fixture.table.id,
      status: "closed",
      revision: fixture.table.revision + 1,
    });
    const persisted = await fixture.database.read();
    expect(
      persisted.campaignSessions.find(
        (session) => session.id === fixture.campaignSession.id,
      ),
    ).toMatchObject({ status: "completed", occurredAt });
    expect(
      persisted.virtualTables.find((table) => table.id === fixture.table.id),
    ).toMatchObject({ status: "closed" });
  });

  it("abre, move, oculta, rola e incrementa a revisão da mesa", async () => {
    const fixture = await createOpenTableFixture();
    expect(fixture.table.revision).toBe(1);
    expect(
      (await fixture.repositories.tabletop.findOpenByCampaign(fixture.campaign.id))
        ?.id,
    ).toBe(fixture.table.id);

    const created = await fixture.repositories.tabletop.createToken({
      tableId: fixture.table.id,
      name: fixture.character.name,
      kind: "character",
      characterId: fixture.character.id,
      imageFileId: null,
      x: 0.2,
      y: 0.3,
      size: 0.055,
      zIndex: 1,
      visible: true,
    });
    expect(created.table.revision).toBe(2);

    const moved = await fixture.repositories.tabletop.moveToken(
      fixture.table.id,
      created.token.id,
      0.75,
      0.8,
    );
    expect(moved).not.toBeNull();
    expect(moved?.token).toMatchObject({ x: 0.75, y: 0.8 });
    expect(moved?.table.revision).toBe(3);
    await expect(
      fixture.repositories.tabletop.moveToken(
        fixture.table.id,
        created.token.id,
        1.01,
        0.5,
      ),
    ).rejects.toBeInstanceOf(RangeError);

    const hidden = await fixture.repositories.tabletop.setTokenVisibility(
      fixture.table.id,
      created.token.id,
      false,
    );
    expect(hidden?.token.visible).toBe(false);
    expect(hidden?.table.revision).toBe(4);

    const rolled = await fixture.repositories.tabletop.createRoll({
      tableId: fixture.table.id,
      campaignId: fixture.campaign.id,
      sessionId: fixture.campaignSession.id,
      userId: fixture.player.id,
      actorName: fixture.player.name,
      expression: "1d20",
      diceValues: [17],
      modifier: 0,
      total: 17,
    });
    expect(rolled.table.revision).toBe(5);
    expect(await fixture.repositories.tabletop.listRolls(fixture.table.id)).toMatchObject([
      { expression: "1d20", total: 17, actorName: fixture.player.name },
    ]);

    const closed =
      await fixture.repositories.campaignSessions.completeTableSession(
        fixture.table.id,
        "2027-01-01T23:00:00.000Z",
      );
    expect(closed?.table).toMatchObject({ status: "closed", revision: 6 });
    expect(
      await fixture.repositories.tabletop.moveToken(
        fixture.table.id,
        created.token.id,
        0.4,
        0.4,
      ),
    ).toBeNull();
    await expect(
      fixture.repositories.tabletop.createRoll({
        tableId: fixture.table.id,
        campaignId: fixture.campaign.id,
        sessionId: fixture.campaignSession.id,
        userId: fixture.player.id,
        actorName: fixture.player.name,
        expression: "1d6",
        diceValues: [4],
        modifier: 0,
        total: 4,
      }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
    await expect(
      fixture.repositories.tabletop.open({
        campaignId: fixture.campaign.id,
        sessionId: fixture.campaignSession.id,
        openedByUserId: fixture.gameMaster.id,
      }),
    ).rejects.toMatchObject({ field: "session" });

    const otherSession = await fixture.repositories.campaignSessions.create({
      campaignId: fixture.campaign.id,
      sessionNumber: 2,
      title: "Outra incursão",
      status: "scheduled",
      scheduledAt: "2027-01-08T22:00:00.000Z",
      occurredAt: null,
      summary: "",
      description: "",
      events: "",
      consequences: "",
    });
    const nextTable = await fixture.repositories.tabletop.open({
      campaignId: fixture.campaign.id,
      sessionId: otherSession.id,
      openedByUserId: fixture.gameMaster.id,
    });
    expect(nextTable).toMatchObject({
      sessionId: otherSession.id,
      status: "open",
      revision: 1,
    });
    expect(nextTable.id).not.toBe(fixture.table.id);
  });

  it("remove mesa, tokens e rolagens ao excluir a sessão", async () => {
    const fixture = await createOpenTableFixture();
    const mapFile = await fixture.repositories.files.create({
      campaignId: fixture.campaign.id,
      createdByUserId: fixture.gameMaster.id,
      name: "Mapa temporário",
      description: "",
      category: "map",
      visibility: "members",
      storageKey: "table-tests/map.png",
      mimeType: "image/png",
      sizeBytes: 128,
    });
    const tokenFile = await fixture.repositories.files.create({
      campaignId: fixture.campaign.id,
      createdByUserId: fixture.gameMaster.id,
      name: "Token temporário",
      description: "",
      category: "image",
      visibility: "members",
      storageKey: "table-tests/token.png",
      mimeType: "image/png",
      sizeBytes: 64,
    });
    await fixture.repositories.tabletop.setMapFile(
      fixture.table.id,
      mapFile.id,
    );
    const token = (
      await fixture.repositories.tabletop.createToken({
        tableId: fixture.table.id,
        name: "Ameaça",
        kind: "enemy",
        characterId: null,
        imageFileId: tokenFile.id,
        x: 0.5,
        y: 0.5,
        size: 0.055,
        zIndex: 1,
        visible: true,
      })
    ).token;
    await fixture.repositories.tabletop.createRoll({
      tableId: fixture.table.id,
      campaignId: fixture.campaign.id,
      sessionId: fixture.campaignSession.id,
      userId: fixture.gameMaster.id,
      actorName: fixture.gameMaster.name,
      expression: "1d100",
      diceValues: [82],
      modifier: 0,
      total: 82,
    });

    const deletion =
      await fixture.repositories.campaignSessions.deleteWithTableFiles(
        fixture.campaignSession.id,
      );

    expect(new Set(deletion.fileIds)).toEqual(
      new Set([mapFile.id, tokenFile.id]),
    );
    expect(
      await fixture.repositories.tabletop.findBySession(fixture.campaignSession.id),
    ).toBeNull();
    expect(await fixture.repositories.tabletop.findTokenById(token.id)).toBeNull();
    expect(await fixture.repositories.tabletop.listRolls(fixture.table.id)).toEqual([]);
    const snapshot = await fixture.database.read();
    expect(snapshot.virtualTables).toEqual([]);
    expect(snapshot.virtualTableTokens).toEqual([]);
    expect(snapshot.diceRolls).toEqual([]);
  });

  it("remove o token do personagem excluído e revisa a mesa", async () => {
    const fixture = await createOpenTableFixture();
    await fixture.repositories.tabletop.createToken({
      tableId: fixture.table.id,
      name: fixture.character.name,
      kind: "character",
      characterId: fixture.character.id,
      imageFileId: null,
      x: 0.4,
      y: 0.4,
      size: 0.055,
      zIndex: 1,
      visible: true,
    });
    const beforeDelete = await fixture.repositories.tabletop.findById(
      fixture.table.id,
    );

    await fixture.repositories.characters.delete(fixture.character.id);

    expect(
      await fixture.repositories.tabletop.listTokensByCharacter(
        fixture.character.id,
      ),
    ).toEqual([]);
    expect(
      (await fixture.repositories.tabletop.findById(fixture.table.id))?.revision,
    ).toBe((beforeDelete?.revision ?? 0) + 1);
  });
});

describe("snapshot compartilhado", () => {
  it("omite tokens ocultos do jogador e os preserva para o mestre", async () => {
    const fixture = await createOpenTableFixture();
    await fixture.repositories.tabletop.createToken({
      tableId: fixture.table.id,
      name: fixture.character.name,
      kind: "character",
      characterId: fixture.character.id,
      imageFileId: null,
      x: 0.3,
      y: 0.4,
      size: 0.055,
      zIndex: 1,
      visible: true,
    });
    await fixture.repositories.tabletop.createToken({
      tableId: fixture.table.id,
      name: "Inimigo oculto",
      kind: "enemy",
      characterId: null,
      imageFileId: null,
      x: 0.7,
      y: 0.6,
      size: 0.055,
      zIndex: 2,
      visible: false,
    });
    await fixture.repositories.tabletop.createRoll({
      tableId: fixture.table.id,
      campaignId: fixture.campaign.id,
      sessionId: fixture.campaignSession.id,
      userId: fixture.player.id,
      actorName: fixture.player.name,
      expression: "2d6+3",
      diceValues: [4, 6],
      modifier: 3,
      total: 13,
    });

    const fileStorage = new LocalFileStorageProvider({
      rootPath: path.join(fixture.directory, "uploads"),
    });
    const reader = new LocalTabletopReadRepository(
      fixture.database,
      fileStorage,
    );
    const playerSnapshot = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      { includeHiddenTokens: false },
    );
    const gameMasterSnapshot = await reader.findOpenSnapshotByCampaignSlug(
      fixture.campaign.slug,
      { includeHiddenTokens: true },
    );

    expect(playerSnapshot).not.toBeNull();
    expect(gameMasterSnapshot).not.toBeNull();
    expect(playerSnapshot?.tokens.map((token) => token.name)).toEqual([
      fixture.character.name,
    ]);
    expect(gameMasterSnapshot?.tokens.map((token) => token.name)).toEqual([
      fixture.character.name,
      "Inimigo oculto",
    ]);
    expect(
      gameMasterSnapshot?.tokens.find(
        (token) => token.name === "Inimigo oculto",
      ),
    ).toMatchObject({ visible: false, controllerUserId: null });
    expect(playerSnapshot?.tokens[0]).toMatchObject({
      characterId: fixture.character.id,
      controllerUserId: fixture.player.id,
      visible: true,
    });
    expect(playerSnapshot?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: fixture.gameMaster.id,
          role: "game_master",
        }),
        expect.objectContaining({
          userId: fixture.player.id,
          role: "player",
          characters: [
            { id: fixture.character.id, name: fixture.character.name },
          ],
        }),
      ]),
    );
    expect(playerSnapshot?.rolls).toMatchObject([
      { expression: "2d6+3", diceValues: [4, 6], total: 13 },
    ]);
    expect(playerSnapshot?.table.revision).toBe(
      gameMasterSnapshot?.table.revision,
    );
  });
});
