"use client";

import { useActionState } from "react";

import { initialMutationState } from "@/application/forms/mutation-state";
import {
  deleteCharacterOptionAction,
  saveCharacterOptionAction,
} from "@/app/admin/actions";
import {
  ActionFeedback,
  ConfirmDeleteForm,
  FieldError,
  SubmitButton,
} from "@/components/forms/action-ui";
import { CurrentImageControl } from "@/components/forms/current-image-control";
import { getCharacterAttributeDefinitions } from "@/domain/character-attributes";
import type {
  Campaign,
  CharacterClassOption,
  CharacterStatusOption,
} from "@/domain/entities";

type OptionKind = "status" | "class";
type OptionRecord = CharacterStatusOption | CharacterClassOption;

export function CharacterOptionAdminForm({
  campaign,
  kind,
  option,
}: {
  campaign: Campaign;
  kind: OptionKind;
  option?: OptionRecord;
}) {
  const [state, formAction] = useActionState(
    saveCharacterOptionAction,
    initialMutationState,
  );
  const isStatus = kind === "status";
  const classOption = isStatus
    ? undefined
    : (option as CharacterClassOption | undefined);
  const attributeDefinitions = getCharacterAttributeDefinitions(campaign.slug);

  return (
    <form
      action={formAction}
      className={`admin-option-form ${isStatus ? "status-option-form" : "class-option-form"}`}
    >
      <input type="hidden" name="id" value={option?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaign.id} />
      <input type="hidden" name="kind" value={kind} />
      <label>
        <span>Nome</span>
        <input name="name" defaultValue={option?.name ?? ""} required />
        <FieldError state={state} name="name" />
      </label>
      <label>
        <span>Slug</span>
        <input name="slug" defaultValue={option?.slug ?? ""} required />
        <FieldError state={state} name="slug" />
      </label>
      {isStatus ? (
        <label>
          <span>Cor</span>
          <input
            type="color"
            name="color"
            defaultValue={(option as CharacterStatusOption | undefined)?.color ?? "#66737d"}
          />
          <FieldError state={state} name="color" />
        </label>
      ) : (
        <>
          <label className="wide-field">
            <span>Descrição</span>
            <input
              name="description"
              defaultValue={classOption?.description ?? ""}
            />
            <FieldError state={state} name="description" />
          </label>

          <div className="full-span grid gap-3">
            <div>
              <span className="font-mono text-[.58rem] font-bold uppercase tracking-[.1em] text-zinc-300">
                Bônus de atributos
              </span>
              <small className="block pt-1 normal-case tracking-normal">
                Pontos extras concedidos pela classe, de 0 a 5 por atributo.
              </small>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {attributeDefinitions.map(({ key, label }) => {
                const fieldName = `bonus_${key}`;
                return (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      name={fieldName}
                      min="0"
                      max="5"
                      step="1"
                      defaultValue={classOption?.attributeBonuses?.[key] ?? 0}
                      required
                    />
                    <FieldError state={state} name={fieldName} />
                  </label>
                );
              })}
            </div>
          </div>

          <label className="wide-field">
            <span>Logo da classe</span>
            <input
              type="file"
              name="logoImage"
              accept="image/jpeg,image/png,image/webp,image/avif"
            />
            <small>
              {classOption?.logoImageUrl
                ? "Envie uma imagem apenas para substituir a logo atual."
                : "Imagem quadrada em JPEG, PNG, WebP ou AVIF · até 6 MB."}
            </small>
            <FieldError state={state} name="logoImage" />
          </label>
          {classOption?.logoImageUrl ? (
            <div className="wide-field">
              <CurrentImageControl
                src={classOption.logoImageUrl}
                alt={`Logo atual da classe ${classOption.name}`}
                removeName="removeLogoImage"
                variant="logo"
              />
            </div>
          ) : null}
        </>
      )}
      <label>
        <span>Ordem</span>
        <input type="number" min="1" name="order" defaultValue={option?.order ?? 1} required />
        <FieldError state={state} name="order" />
      </label>
      <label className="admin-checkbox compact-checkbox">
        <input type="checkbox" name="active" defaultChecked={option?.active ?? true} />
        <span>Ativa</span>
      </label>
      <div className="option-actions">
        <SubmitButton className="admin-small-button">
          {option ? "Salvar" : "Adicionar"}
        </SubmitButton>
        {option ? (
          <ConfirmDeleteForm
            action={deleteCharacterOptionAction}
            id={option.id}
            hiddenFields={{ kind }}
            label="Excluir"
            description={`Excluir a opção “${option.name}”?`}
          />
        ) : null}
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
