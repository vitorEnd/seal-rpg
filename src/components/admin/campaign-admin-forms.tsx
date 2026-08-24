"use client";

import { useActionState } from "react";

import { initialMutationState } from "@/application/forms/mutation-state";
import {
  deleteCampaignAction,
  saveCampaignAction,
} from "@/app/admin/actions";
import { campaignStatusLabel } from "@/components/campaigns/campaign-presenters";
import {
  ActionFeedback,
  ConfirmDeleteForm,
  FieldError,
  SubmitButton,
} from "@/components/forms/action-ui";
import { CurrentImageControl } from "@/components/forms/current-image-control";
import type { Campaign, User } from "@/domain/entities";

const campaignStatuses = [
  "draft",
  "recruiting",
  "active",
  "paused",
  "completed",
] as const;

function dateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function CampaignAdminForm({
  campaign,
  managers,
}: {
  campaign?: Campaign;
  managers: User[];
}) {
  const [state, formAction] = useActionState(
    saveCampaignAction,
    initialMutationState,
  );
  const isEditing = Boolean(campaign);

  return (
    <form action={formAction} className="admin-record-form">
      <input type="hidden" name="id" value={campaign?.id ?? ""} />
      <div className="admin-form-heading">
        <div>
          <p className="admin-kicker">{isEditing ? "Campanha cadastrada" : "Novo arquivo"}</p>
          <h3>{campaign?.name ?? "Criar campanha"}</h3>
        </div>
        {campaign ? (
          <span className="admin-status-pill">{campaignStatusLabel(campaign.status)}</span>
        ) : null}
      </div>

      <fieldset className="admin-fieldset">
        <legend>Identidade</legend>
        <div className="admin-form-grid two-columns">
          <label>
            <span>Nome</span>
            <input name="name" defaultValue={campaign?.name ?? ""} required />
            <FieldError state={state} name="name" />
          </label>
          <label>
            <span>Slug</span>
            <input name="slug" defaultValue={campaign?.slug ?? ""} placeholder="operacao-neptune" required />
            <FieldError state={state} name="slug" />
          </label>
          <label className="full-span">
            <span>Descrição curta</span>
            <textarea name="shortDescription" rows={2} defaultValue={campaign?.shortDescription ?? ""} required />
            <FieldError state={state} name="shortDescription" />
          </label>
          <label className="full-span">
            <span>Descrição completa</span>
            <textarea name="description" rows={6} defaultValue={campaign?.description ?? ""} required />
            <FieldError state={state} name="description" />
          </label>
          <label>
            <span>Gênero</span>
            <input name="genre" defaultValue={campaign?.genre ?? ""} required />
            <FieldError state={state} name="genre" />
          </label>
          <label>
            <span>Cenário</span>
            <input name="setting" defaultValue={campaign?.setting ?? ""} required />
            <FieldError state={state} name="setting" />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={campaign?.status ?? "draft"}>
              {campaignStatuses.map((status) => (
                <option key={status} value={status}>{campaignStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Mestre</span>
            <select name="gameMasterUserId" defaultValue={campaign?.gameMasterUserId ?? ""}>
              <option value="">A definir</option>
              {managers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · @{user.username}</option>
              ))}
            </select>
            <FieldError state={state} name="gameMasterUserId" />
          </label>
          <label>
            <span>Data de início</span>
            <input type="date" name="startDate" defaultValue={dateInputValue(campaign?.startDate)} />
            <FieldError state={state} name="startDate" />
          </label>
          <label className="full-span">
            <span>Resumo do estado atual</span>
            <textarea name="storySummary" rows={3} defaultValue={campaign?.storySummary ?? ""} />
            <FieldError state={state} name="storySummary" />
          </label>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Direção visual</legend>
        <div className="admin-form-grid two-columns">
          <label>
            <span>Cor principal</span>
            <div className="color-field">
              <input type="color" name="primaryColor" defaultValue={campaign?.primaryColor ?? "#e8792f"} />
            </div>
          </label>
          <label>
            <span>Cor secundária</span>
            <div className="color-field">
              <input type="color" name="secondaryColor" defaultValue={campaign?.secondaryColor ?? "#66737d"} />
            </div>
          </label>
          <label>
            <span>Capa</span>
            <input type="file" name="coverImage" accept="image/jpeg,image/png,image/webp,image/avif" />
            <small>{campaign?.coverImageUrl ? "Envie apenas para substituir a capa atual." : "JPEG, PNG, WebP ou AVIF · até 6 MB."}</small>
          </label>
          {campaign?.coverImageUrl ? (
            <CurrentImageControl
              src={campaign.coverImageUrl}
              alt={`Capa atual de ${campaign.name}`}
              removeName="removeCoverImage"
            />
          ) : null}
          <label>
            <span>Imagem de fundo</span>
            <input type="file" name="backgroundImage" accept="image/jpeg,image/png,image/webp,image/avif" />
            <small>{campaign?.backgroundImageUrl ? "Envie apenas para substituir o fundo atual." : "Use uma imagem horizontal com espaço para o menu."}</small>
          </label>
          {campaign?.backgroundImageUrl ? (
            <CurrentImageControl
              src={campaign.backgroundImageUrl}
              alt={`Imagem de fundo atual de ${campaign.name}`}
              removeName="removeBackgroundImage"
            />
          ) : null}
        </div>
      </fieldset>

      <div className="admin-form-actions">
        <SubmitButton>{isEditing ? "Salvar alterações" : "Criar campanha"}</SubmitButton>
        <ActionFeedback state={state} />
      </div>

      {campaign ? (
        <div className="admin-danger-zone">
          <div>
            <strong>Excluir campanha</strong>
            <p>Remove capítulos, fichas, sessões e vínculos relacionados.</p>
          </div>
          <ConfirmDeleteForm
            action={deleteCampaignAction}
            id={campaign.id}
            label="Excluir campanha"
            description={`Excluir definitivamente “${campaign.name}” e todos os seus dados?`}
          />
        </div>
      ) : null}
    </form>
  );
}
