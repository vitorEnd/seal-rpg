import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const SNAPSHOT_PATH = path.join(PROJECT_ROOT, ".local", "rpg-vitin.json");
const UPLOAD_ROOT = path.join(PROJECT_ROOT, ".local", "uploads");
const EXPECTED_SNAPSHOT_SHA256 =
  "631DFB18154A70CB41D4E4056B8BD708D1B4174F95D14163EDE5BCE3BC24E030";
const LEGACY_ADMIN_ID = "00000000-0000-4000-8000-000000000001";

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function toSnakeTimestampFields(entity) {
  return {
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  };
}

function mimeTypeForKey(key) {
  const extension = path.extname(key).toLowerCase();
  return {
    ".avif": "image/avif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  }[extension];
}

function localUploadPath(storageKey) {
  const parts = storageKey.split("/");
  if (
    parts.length !== 2 ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Chave de upload inválida no snapshot: ${storageKey}`);
  }
  const target = path.resolve(UPLOAD_ROOT, ...parts);
  const relative = path.relative(UPLOAD_ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Upload fora da pasta permitida: ${storageKey}`);
  }
  return target;
}

function assertSupportedSnapshot(snapshot) {
  const unsupportedCollections = [
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
    "virtualTables",
    "virtualTableTokens",
    "diceRolls",
  ];
  const populated = unsupportedCollections.filter(
    (name) => Array.isArray(snapshot[name]) && snapshot[name].length > 0,
  );
  if (populated.length) {
    throw new Error(
      `O snapshot ganhou dados após a auditoria (${populated.join(", ")}). ` +
        "Interrompido para não descartar conteúdo novo.",
    );
  }
}

async function assertProjectIdentity(supabase, url, expectedRef) {
  const actualRef = new URL(url).hostname.split(".")[0];
  if (actualRef !== expectedRef) {
    throw new Error(
      `A URL aponta para ${actualRef}, mas SUPABASE_PROJECT_REF é ${expectedRef}.`,
    );
  }
  const { data, error } = await supabase.storage.getBucket("campaign-media");
  if (error || data?.id !== "campaign-media" || data.public) {
    throw new Error(
      "O bucket privado campaign-media não foi encontrado no projeto informado. " +
        "Confirme que as migrations foram aplicadas.",
    );
  }
}

async function upsertRows(supabase, table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function ensureAdministrator(supabase, snapshot) {
  const email = requireEnvironment("SEAL_RPG_ADMIN_EMAIL").toLowerCase();
  const password = requireEnvironment("SEAL_RPG_ADMIN_PASSWORD");
  const name = process.env.SEAL_RPG_ADMIN_NAME?.trim() || "Administrador";
  const username = (
    process.env.SEAL_RPG_ADMIN_USERNAME?.trim() || "admin"
  ).toLowerCase();
  if (password.length < 12) {
    throw new Error("SEAL_RPG_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new Error("SEAL_RPG_ADMIN_USERNAME deve usar 3–24 letras, números ou _.");
  }

  const { data: existing, error: lookupError } =
    await supabase.auth.admin.getUserById(LEGACY_ADMIN_ID);
  if (lookupError && !/not found/i.test(lookupError.message)) {
    throw new Error(`Auth: ${lookupError.message}`);
  }

  const attributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: { name, username },
  };
  const authResult = existing?.user
    ? await supabase.auth.admin.updateUserById(LEGACY_ADMIN_ID, attributes)
    : await supabase.auth.admin.createUser({ id: LEGACY_ADMIN_ID, ...attributes });
  if (authResult.error) throw new Error(`Auth: ${authResult.error.message}`);

  const legacyAdmin = snapshot.users.find(
    (user) => user.id === LEGACY_ADMIN_ID,
  );
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name,
      username,
      email,
      role: "admin",
      status: "active",
      updated_at: legacyAdmin?.updatedAt ?? new Date().toISOString(),
    })
    .eq("id", LEGACY_ADMIN_ID);
  if (profileError) throw new Error(`profiles: ${profileError.message}`);
  return { email };
}

async function uploadLegacyMedia(supabase, snapshot) {
  const storageKeys = new Set();
  for (const campaign of snapshot.campaigns) {
    if (campaign.coverImageStorageKey) storageKeys.add(campaign.coverImageStorageKey);
    if (campaign.backgroundImageStorageKey) {
      storageKeys.add(campaign.backgroundImageStorageKey);
    }
  }
  for (const chapter of snapshot.campaignChapters) {
    if (chapter.backgroundImageStorageKey) {
      storageKeys.add(chapter.backgroundImageStorageKey);
    }
  }
  for (const option of snapshot.characterClassOptions) {
    if (option.logoImageStorageKey) storageKeys.add(option.logoImageStorageKey);
  }

  for (const storageKey of storageKeys) {
    const contentType = mimeTypeForKey(storageKey);
    if (!contentType) throw new Error(`Extensão não permitida: ${storageKey}`);
    const bytes = await readFile(localUploadPath(storageKey));
    const { error } = await supabase.storage
      .from("campaign-media")
      .upload(storageKey, bytes, { contentType, upsert: true });
    if (error) throw new Error(`Storage ${storageKey}: ${error.message}`);
  }
  return storageKeys.size;
}

async function importSnapshot(supabase, snapshot) {
  const campaigns = snapshot.campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    short_description: campaign.shortDescription,
    description: campaign.description,
    setting: campaign.setting,
    genre: campaign.genre,
    status: campaign.status,
    cover_image_url: campaign.coverImageUrl,
    cover_image_storage_key: campaign.coverImageStorageKey || null,
    background_image_url: campaign.backgroundImageUrl,
    background_image_storage_key: campaign.backgroundImageStorageKey || null,
    primary_color: campaign.primaryColor,
    secondary_color: campaign.secondaryColor,
    start_date: campaign.startDate || null,
    game_master_user_id: LEGACY_ADMIN_ID,
    story_summary: campaign.storySummary,
    ...toSnakeTimestampFields(campaign),
  }));
  await upsertRows(supabase, "campaigns", campaigns);

  await upsertRows(
    supabase,
    "campaign_members",
    campaigns.map((campaign, index) => ({
      id:
        snapshot.campaignMembers[index]?.id ??
        crypto.randomUUID(),
      campaign_id: campaign.id,
      user_id: LEGACY_ADMIN_ID,
      role: "game_master",
      status: "approved",
      joined_at: campaign.created_at,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
    })),
  );

  await upsertRows(
    supabase,
    "campaign_chapters",
    snapshot.campaignChapters.map((chapter) => ({
      id: chapter.id,
      campaign_id: chapter.campaignId,
      title: chapter.title,
      slug: chapter.slug,
      short_description: chapter.shortDescription,
      description: chapter.description,
      background_image_url: chapter.backgroundImageUrl,
      background_image_storage_key: chapter.backgroundImageStorageKey || null,
      sort_order: chapter.order,
      status: chapter.status,
      // A campanha ainda não teve sessão real: começa novamente pelo prólogo.
      completed_at: null,
      ...toSnakeTimestampFields(chapter),
    })),
  );

  await upsertRows(
    supabase,
    "character_status_options",
    snapshot.characterStatusOptions.map((option) => ({
      id: option.id,
      campaign_id: option.campaignId,
      name: option.name,
      slug: option.slug,
      color: option.color,
      sort_order: option.order,
      active: option.active,
      ...toSnakeTimestampFields(option),
    })),
  );

  await upsertRows(
    supabase,
    "character_class_options",
    snapshot.characterClassOptions.map((option) => ({
      id: option.id,
      campaign_id: option.campaignId,
      name: option.name,
      slug: option.slug,
      description: option.description,
      logo_image_url: option.logoImageUrl,
      logo_image_storage_key: option.logoImageStorageKey || null,
      bonus_physical: option.attributeBonuses.physical,
      bonus_agility: option.attributeBonuses.agility,
      bonus_marksmanship: option.attributeBonuses.marksmanship,
      bonus_perception: option.attributeBonuses.perception,
      bonus_technique: option.attributeBonuses.technique,
      bonus_control: option.attributeBonuses.control,
      bonus_resilience: option.attributeBonuses.resilience ?? 0,
      bonus_intellect: option.attributeBonuses.intellect ?? 0,
      bonus_presence: option.attributeBonuses.presence ?? 0,
      bonus_energy: option.attributeBonuses.energy ?? 0,
      bonus_adaptation: option.attributeBonuses.adaptation ?? 0,
      sort_order: option.order,
      active: option.active,
      ...toSnakeTimestampFields(option),
    })),
  );

  await upsertRows(
    supabase,
    "virtual_table_maps",
    snapshot.virtualTableMaps.map((map) => ({
      id: map.id,
      campaign_id: map.campaignId,
      name: map.name,
      description: map.description,
      group_name: map.groupName,
      layer_name: map.layerName,
      image_file_id: map.imageFileId || null,
      built_in_image_url: map.builtInImageUrl,
      scale: map.scale,
      built_in: map.builtIn,
      sort_order: map.order,
      created_by_user_id: null,
      ...toSnakeTimestampFields(map),
    })),
  );
}

async function main() {
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnvironment("SUPABASE_SECRET_KEY");
  const projectRef = requireEnvironment("SUPABASE_PROJECT_REF");
  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error("Use uma Secret key moderna do novo projeto seal-rpg.");
  }

  const snapshotBytes = await readFile(SNAPSHOT_PATH);
  const actualHash = createHash("sha256").update(snapshotBytes).digest("hex").toUpperCase();
  if (actualHash !== EXPECTED_SNAPSHOT_SHA256) {
    throw new Error(
      `O snapshot mudou (${actualHash}). Faça uma nova auditoria antes de importar.`,
    );
  }
  const snapshot = JSON.parse(snapshotBytes.toString("utf8"));
  assertSupportedSnapshot(snapshot);

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await assertProjectIdentity(supabase, url, projectRef);
  const admin = await ensureAdministrator(supabase, snapshot);
  const uploadCount = await uploadLegacyMedia(supabase, snapshot);
  await importSnapshot(supabase, snapshot);

  console.log(
    `Bootstrap concluído no projeto ${projectRef}: ` +
      `${snapshot.campaigns.length} campanha, ` +
      `${snapshot.campaignChapters.length} capítulos, ` +
      `${snapshot.virtualTableMaps.length} mapas e ${uploadCount} uploads.`,
  );
  console.log(`Administrador criado/atualizado: ${admin.email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
