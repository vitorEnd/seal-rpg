"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  mutationError,
  mutationSuccess,
  type MutationState,
  zodFieldErrors,
} from "@/application/forms/mutation-state";
import {
  dateToIso,
  localDateTimeToIso,
  slugify,
} from "@/application/forms/form-values";
import { CHARACTER_CLASS_BONUS_MAX } from "@/domain/character-attributes";
import { RepositoryConflictError } from "@/domain/repositories";
import { InvalidStoredFileError } from "@/application/storage/file-storage-provider";
import { getCurrentSession } from "@/lib/auth/current-user";
import { fileStorageProvider, repositories } from "@/lib/container";
import { removeTabletopFiles } from "@/lib/tabletop-files";

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, "Use uma cor hexadecimal válida.");
const idSchema = z.string().uuid("Identificador inválido.");
const slugSchema = z
  .string()
  .trim()
  .min(2, "Informe um slug.")
  .max(72, "Use no máximo 72 caracteres.")
  .transform(slugify)
  .refine((value) => value.length >= 2, "Informe um slug válido.");
const optionalDateSchema = z
  .string()
  .refine((value) => dateToIso(value) !== null, "Informe uma data válida.")
  .optional();
const optionalDateTimeSchema = z
  .string()
  .refine(
    (value) => localDateTimeToIso(value) !== null,
    "Informe uma data e hora válidas.",
  )
  .optional();

const campaignSchema = z.object({
  id: z.union([idSchema, z.literal("")]),
  name: z.string().trim().min(2, "Informe o nome da campanha.").max(80),
  slug: slugSchema,
  shortDescription: z.string().trim().min(10, "Escreva uma descrição curta.").max(220),
  description: z.string().trim().min(30, "Descreva melhor a campanha.").max(5000),
  setting: z.string().trim().min(3, "Informe o cenário.").max(180),
  genre: z.string().trim().min(2, "Informe o gênero.").max(80),
  status: z.enum(["draft", "recruiting", "active", "paused", "completed"]),
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  startDate: optionalDateSchema,
  gameMasterUserId: z.union([idSchema, z.literal("")]),
  storySummary: z.string().trim().max(500),
});

const chapterSchema = z.object({
  id: z.union([idSchema, z.literal("")]),
  campaignId: idSchema,
  title: z.string().trim().min(2, "Informe o título.").max(100),
  slug: slugSchema,
  shortDescription: z.string().trim().min(10, "Escreva uma descrição curta.").max(240),
  description: z.string().trim().min(10, "Descreva o capítulo.").max(4000),
  order: z.coerce.number().int().min(1).max(999),
  status: z.enum(["draft", "published"]),
});

const classBonusSchema = z.coerce
  .number("Informe um bônus numérico.")
  .int("Use somente pontos inteiros.")
  .min(0, "O bônus mínimo é zero.")
  .max(
    CHARACTER_CLASS_BONUS_MAX,
    `O bônus máximo por atributo é ${CHARACTER_CLASS_BONUS_MAX}.`,
  );

const optionSchema = z.object({
  id: z.union([idSchema, z.literal("")]),
  campaignId: idSchema,
  kind: z.enum(["status", "class"]),
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  slug: slugSchema,
  color: z.union([colorSchema, z.literal("")]).optional(),
  description: z.string().trim().max(500).optional(),
  bonus_physical: classBonusSchema,
  bonus_agility: classBonusSchema,
  bonus_marksmanship: classBonusSchema,
  bonus_perception: classBonusSchema,
  bonus_technique: classBonusSchema,
  bonus_control: classBonusSchema,
  order: z.coerce.number().int().min(1).max(999),
  active: z.boolean(),
});

const sessionSchema = z
  .object({
    id: z.union([idSchema, z.literal("")]),
    campaignId: idSchema,
    sessionNumber: z.coerce.number().int().min(1).max(9999),
    title: z.string().trim().min(2, "Informe o título.").max(120),
    status: z.enum(["scheduled", "completed", "cancelled"]),
    scheduledAt: optionalDateTimeSchema,
    occurredAt: optionalDateTimeSchema,
    summary: z.string().trim().max(2500),
    description: z.string().trim().max(5000),
    events: z.string().trim().max(5000),
    consequences: z.string().trim().max(5000),
  })
  .superRefine((value, context) => {
    if (value.status === "scheduled" && !value.scheduledAt) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Informe quando a sessão está agendada.",
      });
    }
    if (value.status === "completed" && !value.occurredAt) {
      context.addIssue({
        code: "custom",
        path: ["occurredAt"],
        message: "Informe quando a sessão aconteceu.",
      });
    }
  });

async function isAdmin(): Promise<boolean> {
  const session = await getCurrentSession();
  return session?.user.status === "active" && session.user.role === "admin";
}

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
    url: await fileStorageProvider.getDownloadUrl(stored.key),
    key: stored.key,
  };
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

function refreshCampaign(slug: string) {
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${slug}`);
  revalidatePath(`/campaigns/${slug}/overview`);
  revalidatePath(`/campaigns/${slug}/sheet`);
  revalidatePath(`/campaigns/${slug}/sessions`);
  revalidatePath(`/campaigns/${slug}/table`);
  revalidatePath("/admin");
}

function repositoryError(
  error: unknown,
  previousState: MutationState,
): MutationState | null {
  if (error instanceof RepositoryConflictError) {
    return mutationError(error.message, previousState, {
      [error.field]: [error.message],
    });
  }
  if (error instanceof InvalidStoredFileError) {
    return mutationError(error.message, previousState);
  }
  return null;
}

export async function saveCampaignAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) {
    return mutationError("Somente administradores podem alterar campanhas.", previousState);
  }
  const parsed = campaignSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    setting: formData.get("setting"),
    genre: formData.get("genre"),
    status: formData.get("status"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    startDate: formData.get("startDate") || undefined,
    gameMasterUserId: formData.get("gameMasterUserId") ?? "",
    storySummary: formData.get("storySummary") ?? "",
  });
  if (!parsed.success) {
    return mutationError(
      "Revise os campos da campanha.",
      previousState,
      zodFieldErrors(parsed.error),
    );
  }

  const coverFile = fileFrom(formData, "coverImage");
  const backgroundFile = fileFrom(formData, "backgroundImage");
  const removeCover = formData.get("removeCoverImage") === "on" && !coverFile;
  const removeBackground =
    formData.get("removeBackgroundImage") === "on" && !backgroundFile;
  let createdCampaignId: string | null = null;
  const newStorageKeys: string[] = [];
  try {
    const current = parsed.data.id
      ? await repositories.campaigns.findById(parsed.data.id)
      : null;
    if (parsed.data.id && !current) {
      return mutationError("Campanha não encontrada.", previousState);
    }
    const gameMaster = parsed.data.gameMasterUserId
      ? await repositories.users.findById(parsed.data.gameMasterUserId)
      : null;
    if (
      parsed.data.gameMasterUserId &&
      (!gameMaster || gameMaster.status !== "active" || gameMaster.role === "player")
    ) {
      return mutationError("Selecione um administrador ou mestre válido.", previousState, {
        gameMasterUserId: ["Mestre inválido."],
      });
    }

    const baseInput = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      shortDescription: parsed.data.shortDescription,
      description: parsed.data.description,
      setting: parsed.data.setting,
      genre: parsed.data.genre,
      status: parsed.data.status,
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
      startDate: dateToIso(parsed.data.startDate ?? null),
      gameMasterUserId: parsed.data.gameMasterUserId || null,
      storySummary: parsed.data.storySummary,
    };

    let campaign = current;
    if (!campaign) {
      campaign = await repositories.campaigns.create({
        ...baseInput,
        coverImageUrl: null,
        coverImageStorageKey: null,
        backgroundImageUrl: null,
        backgroundImageStorageKey: null,
      });
      createdCampaignId = campaign.id;
    }

    const cover = coverFile ? await storeImage(coverFile, campaign.id) : null;
    if (cover?.key) newStorageKeys.push(cover.key);
    const background = backgroundFile
      ? await storeImage(backgroundFile, campaign.id)
      : null;
    if (background?.key) newStorageKeys.push(background.key);

    const oldSlug = campaign.slug;
    const oldKeys = [
      cover || removeCover ? campaign.coverImageStorageKey : null,
      background || removeBackground
        ? campaign.backgroundImageStorageKey
        : null,
    ];
    const updated = await repositories.campaigns.update(campaign.id, {
      ...baseInput,
      coverImageUrl: cover?.url ?? (removeCover ? null : campaign.coverImageUrl),
      coverImageStorageKey:
        cover?.key ?? (removeCover ? null : campaign.coverImageStorageKey),
      backgroundImageUrl:
        background?.url ?? (removeBackground ? null : campaign.backgroundImageUrl),
      backgroundImageStorageKey:
        background?.key ??
        (removeBackground ? null : campaign.backgroundImageStorageKey),
    });
    if (!updated) throw new Error("CAMPAIGN_UPDATE_FAILED");
    await removeStoredKeys(oldKeys);
    refreshCampaign(oldSlug);
    if (oldSlug !== updated.slug) refreshCampaign(updated.slug);
    return mutationSuccess(
      current ? "Campanha atualizada." : "Campanha criada e publicada no arquivo.",
      previousState,
    );
  } catch (error) {
    await removeStoredKeys(newStorageKeys);
    if (createdCampaignId) await repositories.campaigns.delete(createdCampaignId);
    return repositoryError(error, previousState) ?? mutationError("Não foi possível salvar a campanha.", previousState);
  }
}

export async function deleteCampaignAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) {
    return mutationError("Somente administradores podem excluir campanhas.", previousState);
  }
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return mutationError("Campanha inválida.", previousState);
  const campaign = await repositories.campaigns.findById(id.data);
  if (!campaign) return mutationError("Campanha não encontrada.", previousState);
  const deletion = await repositories.campaigns.deleteWithStorageKeys(campaign.id);
  if (!deletion.deleted) {
    return mutationError("Campanha não encontrada.", previousState);
  }
  await removeStoredKeys(deletion.storageKeys);
  refreshCampaign(campaign.slug);
  return mutationSuccess("Campanha e todos os dados relacionados foram excluídos.", previousState);
}

export async function saveChapterAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) {
    return mutationError("Somente administradores podem alterar capítulos.", previousState);
  }
  const parsed = chapterSchema.safeParse({
    id: formData.get("id") ?? "",
    campaignId: formData.get("campaignId"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    order: formData.get("order"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return mutationError("Revise os campos do capítulo.", previousState, zodFieldErrors(parsed.error));
  }
  const campaign = await repositories.campaigns.findById(parsed.data.campaignId);
  if (!campaign) return mutationError("Campanha não encontrada.", previousState);
  const imageFile = fileFrom(formData, "backgroundImage");
  const removeImage =
    formData.get("removeBackgroundImage") === "on" && !imageFile;
  let newImage: Awaited<ReturnType<typeof storeImage>> | null = null;
  try {
    const current = parsed.data.id
      ? await repositories.campaignChapters.findById(parsed.data.id)
      : null;
    if (parsed.data.id && (!current || current.campaignId !== campaign.id)) {
      return mutationError("Capítulo não encontrado.", previousState);
    }
    if (imageFile) newImage = await storeImage(imageFile, campaign.id);
    const input = {
      campaignId: campaign.id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      shortDescription: parsed.data.shortDescription,
      description: parsed.data.description,
      backgroundImageUrl:
        newImage?.url ?? (removeImage ? null : current?.backgroundImageUrl ?? null),
      backgroundImageStorageKey:
        newImage?.key ??
        (removeImage ? null : current?.backgroundImageStorageKey ?? null),
      order: parsed.data.order,
      status: parsed.data.status,
    };
    if (current) {
      await repositories.campaignChapters.update(current.id, input);
      if (newImage || removeImage) {
        await removeStoredKeys([current.backgroundImageStorageKey]);
      }
    } else {
      await repositories.campaignChapters.create(input);
    }
    refreshCampaign(campaign.slug);
    return mutationSuccess(current ? "Capítulo atualizado." : "Capítulo criado.", previousState);
  } catch (error) {
    if (newImage) await removeStoredKeys([newImage.key]);
    return repositoryError(error, previousState) ?? mutationError("Não foi possível salvar o capítulo.", previousState);
  }
}

export async function deleteChapterAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return mutationError("Capítulo inválido.", previousState);
  const chapter = await repositories.campaignChapters.findById(id.data);
  if (!chapter) return mutationError("Capítulo não encontrado.", previousState);
  const campaign = await repositories.campaigns.findById(chapter.campaignId);
  try {
    const deleted = await repositories.campaignChapters.delete(chapter.id);
    if (!deleted) {
      return mutationError("Capítulo não encontrado.", previousState);
    }
    await removeStoredKeys([chapter.backgroundImageStorageKey]);
    if (campaign) refreshCampaign(campaign.slug);
    return mutationSuccess("Capítulo excluído.", previousState);
  } catch (error) {
    return (
      repositoryError(error, previousState) ??
      mutationError("Não foi possível excluir o capítulo.", previousState)
    );
  }
}

export async function saveCharacterOptionAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const parsed = optionSchema.safeParse({
    id: formData.get("id") ?? "",
    campaignId: formData.get("campaignId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    color: formData.get("color") ?? undefined,
    description: formData.get("description") ?? undefined,
    bonus_physical: formData.get("bonus_physical") ?? 0,
    bonus_agility: formData.get("bonus_agility") ?? 0,
    bonus_marksmanship: formData.get("bonus_marksmanship") ?? 0,
    bonus_perception: formData.get("bonus_perception") ?? 0,
    bonus_technique: formData.get("bonus_technique") ?? 0,
    bonus_control: formData.get("bonus_control") ?? 0,
    order: formData.get("order"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return mutationError("Revise os campos da opção.", previousState, zodFieldErrors(parsed.error));
  }
  const campaign = await repositories.campaigns.findById(parsed.data.campaignId);
  if (!campaign) return mutationError("Campanha não encontrada.", previousState);
  const logoFile =
    parsed.data.kind === "class" ? fileFrom(formData, "logoImage") : null;
  const removeLogo =
    parsed.data.kind === "class" &&
    formData.get("removeLogoImage") === "on" &&
    !logoFile;
  const newStorageKeys: string[] = [];

  try {
    if (parsed.data.kind === "status") {
      const current = parsed.data.id
        ? await repositories.characterStatusOptions.findById(parsed.data.id)
        : null;
      if (parsed.data.id && (!current || current.campaignId !== campaign.id)) {
        return mutationError("Opção de status não encontrada.", previousState);
      }
      const input = {
        campaignId: campaign.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        color: parsed.data.color || "#66737d",
        order: parsed.data.order,
        active: parsed.data.active,
      };
      if (current) await repositories.characterStatusOptions.update(current.id, input);
      else await repositories.characterStatusOptions.create(input);
    } else {
      const current = parsed.data.id
        ? await repositories.characterClassOptions.findById(parsed.data.id)
        : null;
      if (parsed.data.id && (!current || current.campaignId !== campaign.id)) {
        return mutationError("Opção de classe não encontrada.", previousState);
      }
      const logo = logoFile ? await storeImage(logoFile, campaign.id) : null;
      if (logo) newStorageKeys.push(logo.key);
      const input = {
        campaignId: campaign.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || "",
        logoImageUrl:
          logo?.url ?? (removeLogo ? null : current?.logoImageUrl ?? null),
        logoImageStorageKey:
          logo?.key ??
          (removeLogo ? null : current?.logoImageStorageKey ?? null),
        attributeBonuses: {
          physical: parsed.data.bonus_physical,
          agility: parsed.data.bonus_agility,
          marksmanship: parsed.data.bonus_marksmanship,
          perception: parsed.data.bonus_perception,
          technique: parsed.data.bonus_technique,
          control: parsed.data.bonus_control,
        },
        order: parsed.data.order,
        active: parsed.data.active,
      };
      if (current) {
        const updated = await repositories.characterClassOptions.update(
          current.id,
          input,
        );
        if (!updated) {
          await removeStoredKeys(newStorageKeys);
          newStorageKeys.length = 0;
          return mutationError("Opção de classe não encontrada.", previousState);
        }
        newStorageKeys.length = 0;
        if (logo || removeLogo) {
          await removeStoredKeys([current.logoImageStorageKey]);
        }
      } else {
        await repositories.characterClassOptions.create(input);
        newStorageKeys.length = 0;
      }
    }
    refreshCampaign(campaign.slug);
    return mutationSuccess(parsed.data.id ? "Opção atualizada." : "Opção criada.", previousState);
  } catch (error) {
    await removeStoredKeys(newStorageKeys);
    if (error instanceof InvalidStoredFileError) {
      return mutationError(error.message, previousState, {
        logoImage: [error.message],
      });
    }
    return repositoryError(error, previousState) ?? mutationError("Não foi possível salvar a opção.", previousState);
  }
}

export async function deleteCharacterOptionAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const parsed = z.object({ id: idSchema, kind: z.enum(["status", "class"]) }).safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return mutationError("Opção inválida.", previousState);
  try {
    if (parsed.data.kind === "status") {
      const option = await repositories.characterStatusOptions.findById(
        parsed.data.id,
      );
      if (!option) return mutationError("Opção não encontrada.", previousState);
      const campaign = await repositories.campaigns.findById(option.campaignId);
      const deleted = await repositories.characterStatusOptions.delete(option.id);
      if (!deleted) return mutationError("Opção não encontrada.", previousState);
      if (campaign) refreshCampaign(campaign.slug);
    } else {
      const option = await repositories.characterClassOptions.findById(
        parsed.data.id,
      );
      if (!option) return mutationError("Opção não encontrada.", previousState);
      const campaign = await repositories.campaigns.findById(option.campaignId);
      const deleted = await repositories.characterClassOptions.delete(option.id);
      if (!deleted) return mutationError("Opção não encontrada.", previousState);
      await removeStoredKeys([option.logoImageStorageKey]);
      if (campaign) refreshCampaign(campaign.slug);
    }
    return mutationSuccess("Opção excluída.", previousState);
  } catch (error) {
    return repositoryError(error, previousState) ?? mutationError("Não foi possível excluir a opção.", previousState);
  }
}

export async function saveSessionAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const parsed = sessionSchema.safeParse({
    id: formData.get("id") ?? "",
    campaignId: formData.get("campaignId"),
    sessionNumber: formData.get("sessionNumber"),
    title: formData.get("title"),
    status: formData.get("status"),
    scheduledAt: formData.get("scheduledAt") || undefined,
    occurredAt: formData.get("occurredAt") || undefined,
    summary: formData.get("summary") ?? "",
    description: formData.get("description") ?? "",
    events: formData.get("events") ?? "",
    consequences: formData.get("consequences") ?? "",
  });
  if (!parsed.success) {
    return mutationError("Revise os campos da sessão.", previousState, zodFieldErrors(parsed.error));
  }
  const campaign = await repositories.campaigns.findById(parsed.data.campaignId);
  if (!campaign) return mutationError("Campanha não encontrada.", previousState);
  const input = {
    campaignId: campaign.id,
    sessionNumber: parsed.data.sessionNumber,
    title: parsed.data.title,
    status: parsed.data.status,
    scheduledAt: localDateTimeToIso(parsed.data.scheduledAt ?? null),
    occurredAt: localDateTimeToIso(parsed.data.occurredAt ?? null),
    summary: parsed.data.summary,
    description: parsed.data.description,
    events: parsed.data.events,
    consequences: parsed.data.consequences,
  };
  try {
    if (parsed.data.id) {
      const current = await repositories.campaignSessions.findById(parsed.data.id);
      if (!current || current.campaignId !== campaign.id) {
        return mutationError("Sessão não encontrada.", previousState);
      }
      const updated =
        input.status === "scheduled"
          ? await repositories.campaignSessions.update(current.id, input)
          : await repositories.campaignSessions.updateAndCloseTable(
              current.id,
              input,
            );
      if (!updated) return mutationError("Sessão não encontrada.", previousState);
    } else {
      await repositories.campaignSessions.create(input);
    }
    refreshCampaign(campaign.slug);
    return mutationSuccess(parsed.data.id ? "Sessão atualizada." : "Sessão criada.", previousState);
  } catch (error) {
    return repositoryError(error, previousState) ?? mutationError("Não foi possível salvar a sessão.", previousState);
  }
}

export async function deleteSessionAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return mutationError("Sessão inválida.", previousState);
  const session = await repositories.campaignSessions.findById(id.data);
  if (!session) return mutationError("Sessão não encontrada.", previousState);
  const campaign = await repositories.campaigns.findById(session.campaignId);
  const deletion =
    await repositories.campaignSessions.deleteWithTableFiles(session.id);
  if (!deletion.deleted) {
    return mutationError("Sessão não encontrada.", previousState);
  }
  await removeTabletopFiles(deletion.fileIds);
  if (campaign) refreshCampaign(campaign.slug);
  return mutationSuccess("Sessão excluída.", previousState);
}

const profileAccessSchema = z.object({
  userId: idSchema,
  role: z.enum(["admin", "game_master", "player"]),
  status: z.enum(["active", "disabled"]),
});

const membershipAccessSchema = z.object({
  membershipId: idSchema,
  role: z.enum(["game_master", "player"]),
  status: z.enum(["pending", "approved", "rejected", "removed"]),
});

export async function updateUserAccessAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const parsed = profileAccessSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return mutationError(
      "Revise o papel e o estado desta conta.",
      previousState,
      zodFieldErrors(parsed.error),
    );
  }
  try {
    const updated = await repositories.users.update(parsed.data.userId, {
      role: parsed.data.role,
      status: parsed.data.status,
    });
    if (!updated) return mutationError("Usuário não encontrado.", previousState);
    revalidatePath("/admin");
    return mutationSuccess("Acesso do usuário atualizado.", previousState);
  } catch (error) {
    return (
      repositoryError(error, previousState) ??
      mutationError(
        "Não foi possível atualizar esta conta. Mantenha ao menos um administrador ativo.",
        previousState,
      )
    );
  }
}

export async function updateCampaignMembershipAction(
  previousState: MutationState,
  formData: FormData,
): Promise<MutationState> {
  if (!(await isAdmin())) return mutationError("Acesso negado.", previousState);
  const parsed = membershipAccessSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return mutationError(
      "Revise o papel e o estado da participação.",
      previousState,
      zodFieldErrors(parsed.error),
    );
  }
  const membership = await repositories.campaignMembers.findById(
    parsed.data.membershipId,
  );
  if (!membership) {
    return mutationError("Solicitação não encontrada.", previousState);
  }
  const updated = await repositories.campaignMembers.update(membership.id, {
    role: parsed.data.role,
    status: parsed.data.status,
  });
  if (!updated) return mutationError("Solicitação não encontrada.", previousState);
  revalidatePath("/admin");
  revalidatePath("/campaigns");
  const campaign = await repositories.campaigns.findById(membership.campaignId);
  if (campaign) revalidatePath(`/campaigns/${campaign.slug}`);
  return mutationSuccess("Participação atualizada.", previousState);
}
