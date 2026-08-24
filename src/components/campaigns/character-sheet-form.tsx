"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { initialMutationState } from "@/application/forms/mutation-state";
import {
  deleteCharacterSheetAction,
  saveCharacterSheetAction,
} from "@/app/campaigns/actions";
import {
  ActionFeedback,
  ConfirmDeleteForm,
  FieldError,
} from "@/components/forms/action-ui";
import { CurrentImageControl } from "@/components/forms/current-image-control";
import type {
  Campaign,
  Character,
  CharacterClassOption,
  CharacterStatusOption,
} from "@/domain/entities";
import {
  CHARACTER_ATTRIBUTE_BUDGET,
  CHARACTER_ATTRIBUTE_DEFINITIONS,
  CHARACTER_ATTRIBUTE_KEYS,
  CHARACTER_ATTRIBUTE_MAX,
  EMPTY_CHARACTER_ATTRIBUTES,
  calculateEffectiveAttributes,
  characterAttributeTotal,
  type CharacterAttributeKey,
  type CharacterAttributes,
} from "@/domain/character-attributes";

function initialAttributes(sheet?: Character): CharacterAttributes {
  return Object.fromEntries(
    CHARACTER_ATTRIBUTE_KEYS.map((key) => [
      key,
      sheet?.attributes[key] ?? EMPTY_CHARACTER_ATTRIBUTES[key],
    ]),
  ) as CharacterAttributes;
}

function clampAttribute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(CHARACTER_ATTRIBUTE_MAX, Math.max(0, Math.trunc(value)));
}

export function CharacterSheetForm({
  campaign,
  statusOptions,
  classOptions,
  sheet,
}: {
  campaign: Campaign;
  statusOptions: CharacterStatusOption[];
  classOptions: CharacterClassOption[];
  sheet?: Character;
}) {
  const [state, formAction, pending] = useActionState(
    saveCharacterSheetAction,
    initialMutationState,
  );
  const availableStatuses = statusOptions.filter(
    (option) => option.active || option.id === sheet?.statusOptionId,
  );
  const availableClasses = classOptions.filter(
    (option) => option.active || option.id === sheet?.classOptionId,
  );
  const [selectedClassId, setSelectedClassId] = useState(
    sheet?.classOptionId ?? availableClasses[0]?.id ?? "",
  );
  const [attributes, setAttributes] = useState<CharacterAttributes>(() =>
    initialAttributes(sheet),
  );
  const hasOptions =
    availableStatuses.length > 0 && availableClasses.length > 0;
  const selectedClass = availableClasses.find(
    (option) => option.id === selectedClassId,
  );
  const classBonuses =
    selectedClass?.attributeBonuses ?? EMPTY_CHARACTER_ATTRIBUTES;
  const effectiveAttributes = calculateEffectiveAttributes(
    attributes,
    classBonuses,
  );
  const allocatedPoints = characterAttributeTotal(attributes);
  const remainingPoints = CHARACTER_ATTRIBUTE_BUDGET - allocatedPoints;
  const distributionComplete = remainingPoints === 0;
  const selectedBonuses = CHARACTER_ATTRIBUTE_DEFINITIONS.filter(
    ({ key }) => classBonuses[key] > 0,
  );

  function updateAttribute(key: CharacterAttributeKey, value: number) {
    setAttributes((current) => ({
      ...current,
      [key]: clampAttribute(value),
    }));
  }

  function adjustAttribute(key: CharacterAttributeKey, delta: -1 | 1) {
    setAttributes((current) => {
      if (
        delta > 0 &&
        (characterAttributeTotal(current) >= CHARACTER_ATTRIBUTE_BUDGET ||
          current[key] >= CHARACTER_ATTRIBUTE_MAX)
      ) {
        return current;
      }
      const nextValue = clampAttribute(current[key] + delta);
      return nextValue === current[key]
        ? current
        : { ...current, [key]: nextValue };
    });
  }

  return (
    <form action={formAction} className="sheet-form">
      <input type="hidden" name="id" value={sheet?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaign.id} />
      <div className="sheet-form-heading">
        <div>
          <p className="campaign-kicker">{sheet ? "Editar ficha" : "Nova ficha operacional"}</p>
          <h3>{sheet?.name ?? "Identidade do operador"}</h3>
        </div>
        <span>Dados salvos localmente</span>
      </div>

      {!hasOptions ? (
        <div className="campaign-notice" role="status">
          O administrador ainda precisa criar pelo menos um status e uma classe antes que uma ficha possa ser salva.
        </div>
      ) : null}

      <fieldset className="sheet-fieldset">
        <legend>01 · Identidade</legend>
        <div className="sheet-grid two-columns">
          <label>
            <span>Nome</span>
            <input name="name" defaultValue={sheet?.name ?? ""} required />
            <FieldError state={state} name="name" />
          </label>
          <label>
            <span>Slug</span>
            <input name="slug" defaultValue={sheet?.slug ?? ""} placeholder="nome-do-operador" required />
            <FieldError state={state} name="slug" />
          </label>
          <label>
            <span>Gênero</span>
            <input name="gender" defaultValue={sheet?.gender ?? ""} required />
            <FieldError state={state} name="gender" />
          </label>
          <label>
            <span>Data de início</span>
            <input type="date" name="startDate" defaultValue={sheet?.startDate?.slice(0, 10) ?? ""} />
            <FieldError state={state} name="startDate" />
          </label>
        </div>
      </fieldset>

      <fieldset className="sheet-fieldset">
        <legend>02 · História</legend>
        <div className="sheet-grid">
          <label>
            <span>Descrição curta</span>
            <textarea name="shortDescription" rows={2} defaultValue={sheet?.shortDescription ?? ""} required />
            <FieldError state={state} name="shortDescription" />
          </label>
          <label>
            <span>Descrição completa</span>
            <textarea name="description" rows={6} defaultValue={sheet?.description ?? ""} required />
            <FieldError state={state} name="description" />
          </label>
        </div>
      </fieldset>

      <fieldset className="sheet-fieldset">
        <legend>03 · Classificação</legend>
        <div className="sheet-grid two-columns">
          <label>
            <span>Status</span>
            <select name="statusOptionId" defaultValue={sheet?.statusOptionId ?? availableStatuses[0]?.id ?? ""} required>
              {!availableStatuses.length ? <option value="">Aguardando opções</option> : null}
              {availableStatuses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}{option.active ? "" : " (inativo)"}
                </option>
              ))}
            </select>
            <FieldError state={state} name="statusOptionId" />
          </label>
          <label>
            <span>Classe</span>
            <select
              name="classOptionId"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              required
            >
              {!availableClasses.length ? <option value="">Aguardando opções</option> : null}
              {availableClasses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}{option.active ? "" : " (inativa)"}
                </option>
              ))}
            </select>
            <FieldError state={state} name="classOptionId" />
          </label>
        </div>
        {selectedClass ? (
          <div className="mt-4 grid gap-4 border border-white/10 bg-black/25 p-4 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center">
            {selectedClass.logoImageUrl ? (
              <Image
                src={selectedClass.logoImageUrl}
                alt={`Logo da classe ${selectedClass.name}`}
                width={72}
                height={72}
                unoptimized={selectedClass.logoImageUrl.startsWith("/media/")}
                className="h-[4.5rem] w-[4.5rem] border border-white/10 object-cover"
              />
            ) : (
              <div
                className="grid h-[4.5rem] w-[4.5rem] place-items-center border border-white/10 bg-white/5 font-mono text-lg font-bold text-white/35"
                aria-hidden="true"
              >
                {selectedClass.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-mono text-[.58rem] font-bold uppercase tracking-[.14em] text-orange-400">
                Classe selecionada
              </p>
              <h4 className="mt-1 text-lg font-bold uppercase text-zinc-100">
                {selectedClass.name}
              </h4>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {selectedClass.description || "Classe sem descrição cadastrada."}
              </p>
              <p className="mt-2 font-mono text-[.62rem] uppercase tracking-[.08em] text-zinc-300">
                {selectedBonuses.length
                  ? selectedBonuses
                      .map(
                        ({ key, label }) =>
                          `+${classBonuses[key]} em ${label}`,
                      )
                      .join(" · ")
                  : "Sem bônus de atributo"}
              </p>
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="sheet-fieldset">
        <legend>04 · Atributos</legend>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black/25 p-4">
          <div>
            <p className="font-mono text-[.6rem] font-bold uppercase tracking-[.14em] text-zinc-400">
              Distribuição base
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Divida exatamente {CHARACTER_ATTRIBUTE_BUDGET} pontos. O limite base é {CHARACTER_ATTRIBUTE_MAX} por atributo.
            </p>
          </div>
          <output
            className={`font-mono text-xs font-bold uppercase tracking-[.12em] ${
              distributionComplete ? "text-emerald-300" : "text-orange-300"
            }`}
            aria-live="polite"
          >
            {remainingPoints > 0
              ? `${remainingPoints} restante(s)`
              : remainingPoints < 0
                ? `Retire ${Math.abs(remainingPoints)}`
                : "8 de 8 distribuídos"}
          </output>
          <div
            className="flex w-full gap-1"
            role="progressbar"
            aria-label="Pontos de atributos distribuídos"
            aria-valuemin={0}
            aria-valuemax={CHARACTER_ATTRIBUTE_BUDGET}
            aria-valuenow={Math.min(
              CHARACTER_ATTRIBUTE_BUDGET,
              Math.max(0, allocatedPoints),
            )}
          >
            {Array.from({ length: CHARACTER_ATTRIBUTE_BUDGET }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 ${
                  index < allocatedPoints ? "bg-orange-400" : "bg-white/10"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CHARACTER_ATTRIBUTE_DEFINITIONS.map(({ key, label, description }) => {
            const base = attributes[key];
            const bonus = classBonuses[key];
            const inputId = `${sheet?.id ?? "new"}-attribute-${key}`;
            const descriptionId = `${inputId}-description`;
            return (
              <div
                key={key}
                className="grid min-w-0 gap-4 border border-white/10 bg-[#090c0e] p-4"
              >
                <div>
                  <label
                    htmlFor={inputId}
                    className="font-mono text-[.68rem] font-bold uppercase tracking-[.12em] text-zinc-100"
                  >
                    {label}
                  </label>
                  <p
                    id={descriptionId}
                    className="mt-2 text-xs leading-5 text-zinc-500"
                  >
                    {description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustAttribute(key, -1)}
                    disabled={base <= 0}
                    className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/5 text-lg text-zinc-100 transition hover:border-orange-400/60 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Diminuir ${label}`}
                  >
                    −
                  </button>
                  <input
                    id={inputId}
                    name={`attribute.${key}`}
                    type="number"
                    min={0}
                    max={CHARACTER_ATTRIBUTE_MAX}
                    step={1}
                    inputMode="numeric"
                    value={base}
                    onChange={(event) =>
                      updateAttribute(key, event.currentTarget.valueAsNumber)
                    }
                    aria-describedby={descriptionId}
                    required
                    className="h-10 min-w-0 flex-1 border border-white/15 bg-black/30 px-2 text-center text-lg font-bold text-zinc-50 outline-none focus:border-orange-400/70"
                  />
                  <button
                    type="button"
                    onClick={() => adjustAttribute(key, 1)}
                    disabled={
                      base >= CHARACTER_ATTRIBUTE_MAX ||
                      allocatedPoints >= CHARACTER_ATTRIBUTE_BUDGET
                    }
                    className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/5 text-lg text-zinc-100 transition hover:border-orange-400/60 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Aumentar ${label}`}
                  >
                    +
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 font-mono text-[.58rem] uppercase tracking-[.08em]">
                  <span className="text-zinc-500">Base {base}</span>
                  {bonus > 0 ? (
                    <span className="text-orange-300">Classe +{bonus}</span>
                  ) : null}
                  <strong className="ml-auto text-zinc-100">
                    Total {effectiveAttributes[key]}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <FieldError state={state} name="attributes" />
        </div>
      </fieldset>

      <fieldset className="sheet-fieldset">
        <legend>05 · Aparência</legend>
        <div className="sheet-grid two-columns">
          <label>
            <span>Capa</span>
            <input type="file" name="coverImage" accept="image/jpeg,image/png,image/webp,image/avif" />
            <small>{sheet?.coverImageUrl ? "Envie apenas para substituir a capa atual." : "JPEG, PNG, WebP ou AVIF · até 6 MB."}</small>
          </label>
          {sheet?.coverImageUrl ? (
            <CurrentImageControl
              src={sheet.coverImageUrl}
              alt={`Capa atual de ${sheet.name}`}
              removeName="removeCoverImage"
            />
          ) : null}
          <label>
            <span>Imagem de fundo</span>
            <input type="file" name="backgroundImage" accept="image/jpeg,image/png,image/webp,image/avif" />
            <small>{sheet?.backgroundImageUrl ? "Envie apenas para substituir o fundo atual." : "Imagem horizontal recomendada."}</small>
          </label>
          {sheet?.backgroundImageUrl ? (
            <CurrentImageControl
              src={sheet.backgroundImageUrl}
              alt={`Imagem de fundo atual de ${sheet.name}`}
              removeName="removeBackgroundImage"
            />
          ) : null}
          <label>
            <span>Cor principal</span>
            <input type="color" name="primaryColor" defaultValue={sheet?.primaryColor ?? campaign.primaryColor} />
          </label>
          <label>
            <span>Cor secundária</span>
            <input type="color" name="secondaryColor" defaultValue={sheet?.secondaryColor ?? campaign.secondaryColor} />
          </label>
        </div>
      </fieldset>

      <div className="sheet-form-actions">
        <button
          type="submit"
          disabled={pending || !hasOptions || !distributionComplete}
          className="campaign-primary-button disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Salvando ficha..." : "Salvar ficha"}
        </button>
        {!distributionComplete ? (
          <span className="font-mono text-[.58rem] uppercase tracking-[.1em] text-orange-300" role="status">
            Distribua os 8 pontos para liberar o salvamento.
          </span>
        ) : null}
        <ActionFeedback state={state} />
      </div>

      {sheet ? (
        <div className="sheet-delete-zone">
          <ConfirmDeleteForm
            action={deleteCharacterSheetAction}
            id={sheet.id}
            label="Excluir esta ficha"
            description={`Excluir definitivamente a ficha “${sheet.name}”?`}
          />
        </div>
      ) : null}
    </form>
  );
}
