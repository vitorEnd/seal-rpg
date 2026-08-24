"use client";

import { useActionState } from "react";

import { initialMutationState } from "@/application/forms/mutation-state";
import { deleteChapterAction, saveChapterAction } from "@/app/admin/actions";
import {
  ActionFeedback,
  ConfirmDeleteForm,
  FieldError,
  SubmitButton,
} from "@/components/forms/action-ui";
import { CurrentImageControl } from "@/components/forms/current-image-control";
import type { Campaign, CampaignChapter } from "@/domain/entities";

export function ChapterAdminForm({
  campaign,
  chapter,
}: {
  campaign: Campaign;
  chapter?: CampaignChapter;
}) {
  const [state, formAction] = useActionState(saveChapterAction, initialMutationState);
  return (
    <form action={formAction} className="admin-record-form compact">
      <input type="hidden" name="id" value={chapter?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaign.id} />
      <div className="admin-form-heading">
        <div>
          <p className="admin-kicker">{campaign.name}</p>
          <h3>{chapter?.title ?? "Novo capítulo"}</h3>
        </div>
        {chapter ? <span className="admin-status-pill">Ordem {chapter.order}</span> : null}
      </div>
      <div className="admin-form-grid two-columns">
        <label>
          <span>Título</span>
          <input name="title" defaultValue={chapter?.title ?? ""} required />
          <FieldError state={state} name="title" />
        </label>
        <label>
          <span>Slug</span>
          <input name="slug" defaultValue={chapter?.slug ?? ""} required />
          <FieldError state={state} name="slug" />
        </label>
        <label className="full-span">
          <span>Descrição breve</span>
          <textarea name="shortDescription" rows={2} defaultValue={chapter?.shortDescription ?? ""} required />
          <FieldError state={state} name="shortDescription" />
        </label>
        <label className="full-span">
          <span>Descrição completa</span>
          <textarea name="description" rows={5} defaultValue={chapter?.description ?? ""} required />
          <FieldError state={state} name="description" />
        </label>
        <label>
          <span>Ordem</span>
          <input type="number" min="1" name="order" defaultValue={chapter?.order ?? 1} required />
          <FieldError state={state} name="order" />
        </label>
        <label>
          <span>Publicação</span>
          <select name="status" defaultValue={chapter?.status ?? "draft"}>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
          </select>
        </label>
        <label className="full-span">
          <span>Imagem de fundo do capítulo</span>
          <input type="file" name="backgroundImage" accept="image/jpeg,image/png,image/webp,image/avif" />
          <small>{chapter?.backgroundImageUrl ? "Envie um arquivo apenas para substituir a imagem atual." : "Recomendado: formato horizontal 16:9."}</small>
        </label>
        {chapter?.backgroundImageUrl ? (
          <div className="full-span">
            <CurrentImageControl
              src={chapter.backgroundImageUrl}
              alt={`Imagem atual do capítulo ${chapter.title}`}
              removeName="removeBackgroundImage"
            />
          </div>
        ) : null}
      </div>
      <div className="admin-form-actions">
        <SubmitButton>{chapter ? "Salvar capítulo" : "Adicionar capítulo"}</SubmitButton>
        <ActionFeedback state={state} />
      </div>
      {chapter ? (
        <div className="admin-inline-danger">
          <ConfirmDeleteForm
            action={deleteChapterAction}
            id={chapter.id}
            label="Excluir capítulo"
            description={`Excluir definitivamente “${chapter.title}”?`}
          />
        </div>
      ) : null}
    </form>
  );
}
