"use client";

import { useActionState } from "react";

import {
  updateCampaignMembershipAction,
  updateUserAccessAction,
} from "@/app/admin/actions";
import { initialMutationState } from "@/application/forms/mutation-state";
import { ActionFeedback, SubmitButton } from "@/components/forms/action-ui";
import type { Campaign, CampaignMember, User } from "@/domain/entities";

export function UserAccessAdminForm({ user }: { user: User }) {
  const [state, formAction] = useActionState(
    updateUserAccessAction,
    initialMutationState,
  );
  return (
    <form action={formAction} className="admin-access-form">
      <input type="hidden" name="userId" value={user.id} />
      <div className="admin-access-identity">
        <strong>{user.name}</strong>
        <span>@{user.username} · {user.email}</span>
      </div>
      <label>
        Papel global
        <select name="role" defaultValue={user.role}>
          <option value="player">Jogador</option>
          <option value="game_master">Mestre</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <label>
        Conta
        <select name="status" defaultValue={user.status}>
          <option value="active">Ativa</option>
          <option value="disabled">Desativada</option>
        </select>
      </label>
      <SubmitButton className="admin-small-button">Salvar conta</SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function CampaignMembershipAdminForm({
  membership,
  user,
  campaign,
}: {
  membership: CampaignMember;
  user: User | null;
  campaign: Campaign | null;
}) {
  const [state, formAction] = useActionState(
    updateCampaignMembershipAction,
    initialMutationState,
  );
  return (
    <form action={formAction} className="admin-access-form membership">
      <input type="hidden" name="membershipId" value={membership.id} />
      <div className="admin-access-identity">
        <strong>{user?.name ?? "Usuário removido"}</strong>
        <span>{campaign?.name ?? "Campanha removida"}</span>
      </div>
      <label>
        Papel na campanha
        <select name="role" defaultValue={membership.role}>
          <option value="player">Jogador</option>
          <option value="game_master">Mestre</option>
        </select>
      </label>
      <label>
        Participação
        <select name="status" defaultValue={membership.status}>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovada</option>
          <option value="rejected">Recusada</option>
          <option value="removed">Removida</option>
        </select>
      </label>
      <SubmitButton className="admin-small-button">Salvar acesso</SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
