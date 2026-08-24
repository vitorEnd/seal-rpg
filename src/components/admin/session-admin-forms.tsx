"use client";

import { useActionState } from "react";

import { initialMutationState } from "@/application/forms/mutation-state";
import { deleteSessionAction, saveSessionAction } from "@/app/admin/actions";
import {
  ActionFeedback,
  ConfirmDeleteForm,
  FieldError,
  SubmitButton,
} from "@/components/forms/action-ui";
import type { Campaign, CampaignSession } from "@/domain/entities";

const localDateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
});

function dateTimeInputValue(value: string | null | undefined): string {
  return value
    ? localDateTimeFormatter.format(new Date(value)).replace(" ", "T")
    : "";
}

export function SessionAdminForm({
  campaign,
  session,
  nextNumber,
}: {
  campaign: Campaign;
  session?: CampaignSession;
  nextNumber: number;
}) {
  const [state, formAction] = useActionState(saveSessionAction, initialMutationState);
  return (
    <form action={formAction} className="admin-record-form compact">
      <input type="hidden" name="id" value={session?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaign.id} />
      <div className="admin-form-heading">
        <div>
          <p className="admin-kicker">{campaign.name}</p>
          <h3>{session ? `Sessão ${session.sessionNumber}` : "Agendar ou registrar sessão"}</h3>
        </div>
      </div>
      <div className="admin-form-grid two-columns">
        <label>
          <span>Número</span>
          <input type="number" min="1" name="sessionNumber" defaultValue={session?.sessionNumber ?? nextNumber} required />
          <FieldError state={state} name="sessionNumber" />
        </label>
        <label>
          <span>Título</span>
          <input name="title" defaultValue={session?.title ?? ""} required />
          <FieldError state={state} name="title" />
        </label>
        <label>
          <span>Estado</span>
          <select name="status" defaultValue={session?.status ?? "scheduled"}>
            <option value="scheduled">Agendada</option>
            <option value="completed">Realizada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label>
          <span>Data agendada</span>
          <input type="datetime-local" name="scheduledAt" defaultValue={dateTimeInputValue(session?.scheduledAt)} />
          <FieldError state={state} name="scheduledAt" />
        </label>
        <label>
          <span>Quando aconteceu</span>
          <input type="datetime-local" name="occurredAt" defaultValue={dateTimeInputValue(session?.occurredAt)} />
          <FieldError state={state} name="occurredAt" />
        </label>
        <label className="full-span">
          <span>Resumo</span>
          <textarea name="summary" rows={3} defaultValue={session?.summary ?? ""} />
          <FieldError state={state} name="summary" />
        </label>
        <label className="full-span">
          <span>Descrição completa</span>
          <textarea name="description" rows={4} defaultValue={session?.description ?? ""} />
          <FieldError state={state} name="description" />
        </label>
        <label className="full-span">
          <span>Acontecimentos</span>
          <textarea name="events" rows={3} defaultValue={session?.events ?? ""} />
          <FieldError state={state} name="events" />
        </label>
        <label className="full-span">
          <span>Consequências</span>
          <textarea name="consequences" rows={3} defaultValue={session?.consequences ?? ""} />
          <FieldError state={state} name="consequences" />
        </label>
      </div>
      <div className="admin-form-actions">
        <SubmitButton>{session ? "Salvar sessão" : "Criar sessão"}</SubmitButton>
        <ActionFeedback state={state} />
      </div>
      {session ? (
        <div className="admin-inline-danger">
          <ConfirmDeleteForm
            action={deleteSessionAction}
            id={session.id}
            label="Excluir sessão"
            description={`Excluir a sessão ${session.sessionNumber} — ${session.title}?`}
          />
        </div>
      ) : null}
    </form>
  );
}
