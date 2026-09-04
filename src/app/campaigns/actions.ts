"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dateToIso, slugify } from "@/application/forms/form-values";
import {
  mutationError,
  mutationSuccess,
  type MutationState,
  zodFieldErrors,
} from "@/application/forms/mutation-state";
import {
  CHARACTER_ATTRIBUTE_KEYS,
  CHARACTER_ATTRIBUTE_MAX,
  characterAttributeTotal,
  getCharacterAttributeBudget,
  getCharacterAttributeDefinitions,
} from "@/domain/character-attributes";
import { getCharacterOptionTerminology } from "@/domain/campaign-rules";
import { canViewCampaign } from "@/domain/permissions";
import { RepositoryConflictError } from "@/domain/repositories";
import { InvalidStoredFileError } from "@/application/storage/file-storage-provider";
import { getCurrentSession } from "@/lib/auth/current-user";
import { fileStorageProvider, repositories } from "@/lib/container";
import { removeTabletopFiles } from "@/lib/tabletop-files";

const idSchema = z.string().uuid();
const accessRequestSchema = z.object({
  campaignId: idSchema,
  campaignSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Campanha inválida."),
});
const colorSchema = z.string().trim().regex(/^#[0-9a-f]{6}$/i, "Cor inválida.");
const optionalDateSchema = z
  .string()
  .refine((value) => dateToIso(value) !== null, "Informe uma data válida.")
  .optional();
const attributeScoreSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Use um número inteiro entre 0 e 5.")
  .transform(Number)
  .refine(
    (value) => value >= 0 && value <= CHARACTER_ATTRIBUTE_MAX,
    `Cada atributo pode ter no máximo ${CHARACTER_ATTRIBUTE_MAX} pontos base.`,
  );
const characterAttributesSchema = z
  .object({
    physical: attributeScoreSchema,
    agility: attributeScoreSchema,
    marksmanship: attributeScoreSchema,
    perception: attributeScoreSchema,
    technique: attributeScoreSchema,
    control: attributeScoreSchema,
    resilience: attributeScoreSchema,
    intellect: attributeScoreSchema,
    presence: attributeScoreSchema,
    energy: attributeScoreSchema,
    adaptation: attributeScoreSchema,
  });
const sheetSchema = z.object({
  id: z.union([idSchema, z.literal("")]),
  campaignId: idSchema,
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  slug: z
    .string()
    .trim()
    .transform(slugify)
    .refine((value) => value.length >= 2, "Informe um slug válido."),
  shortDescription: z.string().trim().min(10, "Escreva uma descrição curta.").max(220),
  description: z.string().trim().min(20, "Escreva a descrição completa.").max(5000),
  gender: z.string().trim().min(1, "Informe o gênero.").max(60),
  statusOptionId: idSchema,
  classOptionId: idSchema,
  attributes: characterAttributesSchema,
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  startDate: optionalDateSchema,
});

function fileFrom(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function storeImage(file: File, campaignId: string) {
  const stored = await fileStorageProvider.store({
    campaignId,
    originalName: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return {
    key: stored.key,
    url: await fileStorageProvider.getDownloadUrl(stored.key),
  };
}

function refreshCampaign(slug: string) {
  revalidatePath(`/campaigns/${slug}`);
  revalidatePath(`/campaigns/${slug}/sheet`);
  revalidatePath(`/campaigns/${slug}/table`);
  revalidatePath("/admin");
}

async function removeStoredKeys(keys: Array<string | null | undefined>) {
  const results = await Promise.allSettled(
    keys
      .filter((key): key is string => Boolean(key))
      .map((key) => fileStorageProvider.remove(key)),
  );
  const failureCount = results.filter((result) => result.status === "rejected").length;
  if (failureCount) {
    console.warn(`Não foi possível limpar ${failureCount} arquivo(s) local(is).`);
  }
}

export async function requestCampaignAccessAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const session = await getCurrentSession();
  if (!session) {
    return mutationError(
      "Entre novamente para solicitar acesso.",
      previousState,
    );
  }

  const parsed = accessRequestSchema.safeParse({
    campaignId: formData.get("campaignId"),
    campaignSlug: formData.get("campaignSlug"),
  });
  if (!parsed.success) {
    return mutationError("Campanha inválida.", previousState);
  }

  try {
    const membership = await repositories.campaignMembers.requestAccess(
      parsed.data.campaignId,
      session.user.id,
    );

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${parsed.data.campaignSlug}`);
    revalidatePath("/admin");

    return mutationSuccess(
      membership.status === "approved"
        ? "Seu acesso a esta campanha já está aprovado."
        : "Solicitação enviada. O administrador já pode aprovar seu acesso.",
      previousState,
    );
  } catch {
    return mutationError(
      "Não foi possível solicitar acesso agora. Tente novamente.",
      previousState,
    );
  }
}

export async function saveCharacterSheetAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const session = await getCurrentSession();
  if (!session) return mutationError("Entre novamente para salvar sua ficha.", previousState);
  const parsed = sheetSchema.safeParse({
    id: formData.get("id") ?? "",
    campaignId: formData.get("campaignId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    gender: formData.get("gender"),
    statusOptionId: formData.get("statusOptionId"),
    classOptionId: formData.get("classOptionId"),
    attributes: Object.fromEntries(
      CHARACTER_ATTRIBUTE_KEYS.map((key) => [
        key,
        formData.get(`attribute.${key}`) ?? "0",
      ]),
    ),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    startDate: formData.get("startDate") || undefined,
  });
  if (!parsed.success) {
    return mutationError("Revise os campos da ficha.", previousState, zodFieldErrors(parsed.error));
  }

  const campaign = await repositories.campaigns.findById(parsed.data.campaignId);
  if (!campaign) return mutationError("Campanha não encontrada.", previousState);
  const attributeDefinitions = getCharacterAttributeDefinitions(campaign.slug);
  const activeAttributeKeys = attributeDefinitions.map(({ key }) => key);
  const activeAttributeSet = new Set(activeAttributeKeys);
  const attributeBudget = getCharacterAttributeBudget(campaign.slug);
  const allocatedPoints = characterAttributeTotal(
    parsed.data.attributes,
    activeAttributeKeys,
  );
  const hasUnexpectedAttributePoints = CHARACTER_ATTRIBUTE_KEYS.some(
    (key) => !activeAttributeSet.has(key) && parsed.data.attributes[key] !== 0,
  );
  if (allocatedPoints !== attributeBudget || hasUnexpectedAttributePoints) {
    const difference = attributeBudget - allocatedPoints;
    const message = hasUnexpectedAttributePoints
      ? "A distribuição contém atributos que não pertencem a esta campanha."
      : difference > 0
        ? `Distribua os ${difference} ponto(s) restante(s).`
        : `Retire ${Math.abs(difference)} ponto(s) da distribuição.`;
    return mutationError("Revise os atributos da ficha.", previousState, {
      attributes: [message],
    });
  }
  const membership = await repositories.campaignMembers.findMembership(
    campaign.id,
    session.user.id,
  );
  if (!canViewCampaign(session.user, campaign, membership)) {
    return mutationError("Você não tem acesso a esta campanha.", previousState);
  }

  const current = parsed.data.id
    ? await repositories.characters.findById(parsed.data.id)
    : null;
  if (parsed.data.id && (!current || current.campaignId !== campaign.id)) {
    return mutationError("Ficha não encontrada.", previousState);
  }
  if (
    current &&
    current.userId !== session.user.id &&
    session.user.role !== "admin"
  ) {
    return mutationError("Você só pode alterar a própria ficha.", previousState);
  }

  const [statusOption, classOption] = await Promise.all([
    repositories.characterStatusOptions.findById(parsed.data.statusOptionId),
    repositories.characterClassOptions.findById(parsed.data.classOptionId),
  ]);
  if (
    !statusOption ||
    !classOption ||
    (!statusOption.active && statusOption.id !== current?.statusOptionId) ||
    (!classOption.active && classOption.id !== current?.classOptionId) ||
    statusOption.campaignId !== campaign.id ||
    classOption.campaignId !== campaign.id
  ) {
    const terminology = getCharacterOptionTerminology(campaign.slug);
    return mutationError(
      `Escolha um status e ${terminology.article} válidos para esta campanha.`,
      previousState,
    );
  }

  const coverFile = fileFrom(formData, "coverImage");
  const backgroundFile = fileFrom(formData, "backgroundImage");
  const removeCover = formData.get("removeCoverImage") === "on" && !coverFile;
  const removeBackground =
    formData.get("removeBackgroundImage") === "on" && !backgroundFile;
  const newKeys: string[] = [];
  try {
    const cover = coverFile ? await storeImage(coverFile, campaign.id) : null;
    if (cover?.key) newKeys.push(cover.key);
    const background = backgroundFile
      ? await storeImage(backgroundFile, campaign.id)
      : null;
    if (background?.key) newKeys.push(background.key);
    const input = {
      campaignId: campaign.id,
      userId: current?.userId ?? session.user.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      shortDescription: parsed.data.shortDescription,
      description: parsed.data.description,
      gender: parsed.data.gender,
      statusOptionId: statusOption.id,
      classOptionId: classOption.id,
      attributes: parsed.data.attributes,
      coverImageUrl:
        cover?.url ?? (removeCover ? null : current?.coverImageUrl ?? null),
      coverImageStorageKey:
        cover?.key ?? (removeCover ? null : current?.coverImageStorageKey ?? null),
      backgroundImageUrl:
        background?.url ??
        (removeBackground ? null : current?.backgroundImageUrl ?? null),
      backgroundImageStorageKey:
        background?.key ??
        (removeBackground ? null : current?.backgroundImageStorageKey ?? null),
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
      startDate: dateToIso(parsed.data.startDate ?? null),
      equipment: current?.equipment ?? [],
      wounds: current?.wounds ?? [],
      backpackItems: current?.backpackItems ?? [],
      inventorySlots: current?.inventorySlots ?? 8,
    };
    if (current) {
      await repositories.characters.update(current.id, input);
      await removeStoredKeys([
        cover || removeCover ? current.coverImageStorageKey : null,
        background || removeBackground
          ? current.backgroundImageStorageKey
          : null,
      ]);
    } else {
      await repositories.characters.create(input);
    }
    refreshCampaign(campaign.slug);
    return mutationSuccess(current ? "Ficha atualizada." : "Ficha criada e adicionada à campanha.", previousState);
  } catch (error) {
    await removeStoredKeys(newKeys);
    if (error instanceof RepositoryConflictError) {
      return mutationError(error.message, previousState, { [error.field]: [error.message] });
    }
    if (error instanceof InvalidStoredFileError) {
      return mutationError(error.message, previousState);
    }
    return mutationError("Não foi possível salvar a ficha.", previousState);
  }
}

export async function deleteCharacterSheetAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const session = await getCurrentSession();
  if (!session) return mutationError("Entre novamente para excluir a ficha.", previousState);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return mutationError("Ficha inválida.", previousState);
  const character = await repositories.characters.findById(id.data);
  if (!character) return mutationError("Ficha não encontrada.", previousState);
  if (character.userId !== session.user.id && session.user.role !== "admin") {
    return mutationError("Você só pode excluir a própria ficha.", previousState);
  }
  const campaign = await repositories.campaigns.findById(character.campaignId);
  const deletion = await repositories.characters.deleteWithTableFiles(character.id);
  if (!deletion.deleted) {
    return mutationError("Ficha não encontrada.", previousState);
  }
  await removeTabletopFiles(deletion.fileIds);
  await removeStoredKeys([
    character.coverImageStorageKey,
    character.backgroundImageStorageKey,
  ]);
  if (campaign) refreshCampaign(campaign.slug);
  return mutationSuccess("Ficha excluída.", previousState);
}
