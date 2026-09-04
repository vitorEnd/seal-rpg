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
import {
  CHARACTER_ATTRIBUTE_KEYS,
  CHARACTER_ATTRIBUTE_MAX,
  EMPTY_CHARACTER_ATTRIBUTES,
  calculateEffectiveAttributes,
  characterAttributeTotal,
  getCharacterAttributeBudget,
  getCharacterAttributeDefinitions,
  type CharacterAttributeDefinition,
  type CharacterAttributeKey,
  type CharacterAttributes,
} from "@/domain/character-attributes";
import {
  getCharacterOptionTerminology,
  usesSgioRules,
} from "@/domain/campaign-rules";
import type {
  Campaign,
  Character,
  CharacterClassOption,
  CharacterStatusOption,
} from "@/domain/entities";

const SGIO_ATTRIBUTE_GROUPS: ReadonlyArray<{
  label: string;
  code: string;
  keys: readonly CharacterAttributeKey[];
}> = [
  {
    label: "Capacidades físicas",
    code: "CORPO",
    keys: ["physical", "agility", "marksmanship", "resilience"],
  },
  {
    label: "Cognição e influência",
    code: "MENTE",
    keys: ["perception", "technique", "intellect", "presence"],
  },
  {
    label: "Matriz anômala",
    code: "NEXO",
    keys: ["control", "energy", "adaptation"],
  },
];

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
  const isSgio = usesSgioRules(campaign.slug);
  const terminology = getCharacterOptionTerminology(campaign.slug);
  const attributeDefinitions = getCharacterAttributeDefinitions(campaign.slug);
  const attributeKeys = attributeDefinitions.map(({ key }) => key);
  const attributeBudget = getCharacterAttributeBudget(campaign.slug);
  const availableStatuses = statusOptions.filter(
    (option) => option.active || option.id === sheet?.statusOptionId,
  );
  const availableClasses = classOptions.filter(
    (option) =>
      option.active || (!isSgio && option.id === sheet?.classOptionId),
  );
  const initialClassId = availableClasses.some(
    (option) => option.id === sheet?.classOptionId,
  )
    ? (sheet?.classOptionId ?? "")
    : (availableClasses[0]?.id ?? "");
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [attributes, setAttributes] = useState<CharacterAttributes>(() =>
    initialAttributes(sheet),
  );
  const hasOptions =
    availableStatuses.length > 0 && availableClasses.length > 0;
  const selectedClass = availableClasses.find(
    (option) => option.id === selectedClassId,
  );
  const classBonuses = isSgio
    ? EMPTY_CHARACTER_ATTRIBUTES
    : (selectedClass?.attributeBonuses ?? EMPTY_CHARACTER_ATTRIBUTES);
  const effectiveAttributes = calculateEffectiveAttributes(
    attributes,
    classBonuses,
  );
  const allocatedPoints = characterAttributeTotal(attributes, attributeKeys);
  const remainingPoints = attributeBudget - allocatedPoints;
  const distributionComplete = remainingPoints === 0;
  const selectedBonuses = attributeDefinitions.filter(
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
        (characterAttributeTotal(current, attributeKeys) >= attributeBudget ||
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

  function renderAttributeCard({
    key,
    label,
    description,
  }: CharacterAttributeDefinition) {
    const base = attributes[key];
    const bonus = classBonuses[key];
    const inputId = `${sheet?.id ?? "new"}-attribute-${key}`;
    const descriptionId = `${inputId}-description`;

    return (
      <div
        key={key}
        className={`character-attribute-card ${isSgio ? "sgio-attribute-card" : ""}`}
      >
        <div className="character-attribute-copy">
          <label htmlFor={inputId}>{label}</label>
          <p id={descriptionId}>{description}</p>
        </div>

        <div className="character-attribute-control">
          <button
            type="button"
            onClick={() => adjustAttribute(key, -1)}
            disabled={base <= 0}
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
          />
          <button
            type="button"
            onClick={() => adjustAttribute(key, 1)}
            disabled={
              base >= CHARACTER_ATTRIBUTE_MAX ||
              allocatedPoints >= attributeBudget
            }
            aria-label={`Aumentar ${label}`}
          >
            +
          </button>
        </div>

        <div className="character-attribute-result">
          <span>Base {base}</span>
          {bonus > 0 ? <span>{terminology.singular} +{bonus}</span> : null}
          <strong>Total {effectiveAttributes[key]}</strong>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`sheet-form ${isSgio ? "sheet-form--sgio" : ""}`}
    >
      <input type="hidden" name="id" value={sheet?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaign.id} />
      <div className="sheet-form-heading">
        <div>
          <p className="campaign-kicker">
            {sheet
              ? isSgio
                ? "Editar registro"
                : "Editar ficha"
              : isSgio
                ? "Novo registro extraordinário"
                : "Nova ficha operacional"}
          </p>
          <h3>
            {sheet?.name ?? (isSgio ? "Identidade do agente" : "Identidade do operador")}
          </h3>
        </div>
        <span>{isSgio ? "Arquivo vivo // S.G.I.O." : "Sincronizado com a campanha"}</span>
      </div>

      {!hasOptions ? (
        <div className="campaign-notice" role="status">
          O administrador ainda precisa criar pelo menos um status e {terminology.article} antes que uma ficha possa ser salva.
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
            <input
              name="slug"
              defaultValue={sheet?.slug ?? ""}
              placeholder="nome-do-agente"
              required
            />
            <FieldError state={state} name="slug" />
          </label>
          <label>
            <span>Gênero</span>
            <input name="gender" defaultValue={sheet?.gender ?? ""} required />
            <FieldError state={state} name="gender" />
          </label>
          <label>
            <span>Data de início</span>
            <input
              type="date"
              name="startDate"
              defaultValue={sheet?.startDate?.slice(0, 10) ?? ""}
            />
            <FieldError state={state} name="startDate" />
          </label>
        </div>
      </fieldset>

      <fieldset className="sheet-fieldset">
        <legend>02 · História</legend>
        <div className="sheet-grid">
          <label>
            <span>Descrição curta</span>
            <textarea
              name="shortDescription"
              rows={2}
              defaultValue={sheet?.shortDescription ?? ""}
              required
            />
            <FieldError state={state} name="shortDescription" />
          </label>
          <label>
            <span>Descrição completa</span>
            <textarea
              name="description"
              rows={6}
              defaultValue={sheet?.description ?? ""}
              required
            />
            <FieldError state={state} name="description" />
          </label>
        </div>
      </fieldset>

      <fieldset className={`sheet-fieldset ${isSgio ? "sgio-classification" : ""}`}>
        <legend>03 · Classificação</legend>
        {isSgio ? (
          <div className="sgio-classification-layout">
            <label className="sgio-status-selector">
              <span>Status do registro</span>
              <select
                name="statusOptionId"
                defaultValue={sheet?.statusOptionId ?? availableStatuses[0]?.id ?? ""}
                required
              >
                {!availableStatuses.length ? (
                  <option value="">Aguardando opções</option>
                ) : null}
                {availableStatuses.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}{option.active ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="statusOptionId" />
            </label>

            <div className="sgio-type-selector">
              <div className="sgio-type-heading">
                <span>Tipo biológico</span>
                <small>Escolha a natureza do agente</small>
              </div>
              <div className="sgio-type-grid" role="radiogroup" aria-label="Tipo do agente">
                {availableClasses.map((option, index) => (
                  <label
                    key={option.id}
                    className={`sgio-type-option ${selectedClassId === option.id ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="classOptionId"
                      value={option.id}
                      checked={selectedClassId === option.id}
                      onChange={() => setSelectedClassId(option.id)}
                      required
                    />
                    <span className="sgio-type-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="sgio-type-mark" aria-hidden="true">
                      {option.logoImageUrl ? (
                        <Image
                          src={option.logoImageUrl}
                          alt=""
                          width={54}
                          height={54}
                          unoptimized={option.logoImageUrl.startsWith("/media/")}
                        />
                      ) : (
                        option.name.slice(0, 2).toLocaleUpperCase("pt-BR")
                      )}
                    </span>
                    <span className="sgio-type-copy">
                      <strong>{option.name}</strong>
                      <small>{option.description || "Tipo ainda sem descrição."}</small>
                    </span>
                    <i aria-hidden="true" />
                  </label>
                ))}
              </div>
              <FieldError state={state} name="classOptionId" />
            </div>
          </div>
        ) : (
          <>
            <div className="sheet-grid two-columns">
              <label>
                <span>Status</span>
                <select
                  name="statusOptionId"
                  defaultValue={sheet?.statusOptionId ?? availableStatuses[0]?.id ?? ""}
                  required
                >
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
              <div className="selected-class-card">
                {selectedClass.logoImageUrl ? (
                  <Image
                    src={selectedClass.logoImageUrl}
                    alt={`Logo da classe ${selectedClass.name}`}
                    width={72}
                    height={72}
                    unoptimized={selectedClass.logoImageUrl.startsWith("/media/")}
                  />
                ) : (
                  <div aria-hidden="true">
                    {selectedClass.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
                  </div>
                )}
                <div>
                  <p>Classe selecionada</p>
                  <h4>{selectedClass.name}</h4>
                  <span>{selectedClass.description || "Classe sem descrição cadastrada."}</span>
                  <small>
                    {selectedBonuses.length
                      ? selectedBonuses
                          .map(({ key, label }) => `+${classBonuses[key]} em ${label}`)
                          .join(" · ")
                      : "Sem bônus de atributo"}
                  </small>
                </div>
              </div>
            ) : null}
          </>
        )}
      </fieldset>

      <fieldset className={`sheet-fieldset ${isSgio ? "sgio-attributes-fieldset" : ""}`}>
        <legend>04 · Atributos</legend>
        <div className={`attribute-allocation ${isSgio ? "sgio-point-allocation" : ""}`}>
          <div>
            <p>Distribuição base</p>
            <span>
              Divida exatamente {attributeBudget} pontos. O limite base é {CHARACTER_ATTRIBUTE_MAX} por atributo.
            </span>
          </div>
          <output
            className={distributionComplete ? "is-complete" : ""}
            aria-live="polite"
          >
            {remainingPoints > 0
              ? `${remainingPoints} restante(s)`
              : remainingPoints < 0
                ? `Retire ${Math.abs(remainingPoints)}`
                : `${attributeBudget} de ${attributeBudget} distribuídos`}
          </output>
          <div
            className="attribute-progress"
            role="progressbar"
            aria-label="Pontos de atributos distribuídos"
            aria-valuemin={0}
            aria-valuemax={attributeBudget}
            aria-valuenow={Math.min(attributeBudget, Math.max(0, allocatedPoints))}
          >
            {Array.from({ length: attributeBudget }, (_, index) => (
              <span
                key={index}
                className={index < allocatedPoints ? "is-filled" : ""}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {isSgio ? (
          <div className="sgio-attribute-groups">
            {SGIO_ATTRIBUTE_GROUPS.map((group) => (
              <section key={group.code} className="sgio-attribute-group">
                <header className="sgio-attribute-group-heading">
                  <span>{group.code}</span>
                  <h4>{group.label}</h4>
                  <small>{String(group.keys.length).padStart(2, "0")} parâmetros</small>
                </header>
                <div className="sgio-attribute-grid">
                  {group.keys.map((key) => {
                    const definition = attributeDefinitions.find(
                      (candidate) => candidate.key === key,
                    );
                    return definition ? renderAttributeCard(definition) : null;
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="character-attribute-grid">
            {attributeDefinitions.map(renderAttributeCard)}
          </div>
        )}
        <div className="attribute-field-error">
          <FieldError state={state} name="attributes" />
        </div>
      </fieldset>

      <fieldset className="sheet-fieldset">
        <legend>05 · Aparência</legend>
        <div className="sheet-grid two-columns">
          <label>
            <span>Capa</span>
            <input
              type="file"
              name="coverImage"
              accept="image/jpeg,image/png,image/webp,image/avif"
            />
            <small>
              {sheet?.coverImageUrl
                ? "Envie apenas para substituir a capa atual."
                : "JPEG, PNG, WebP ou AVIF · até 6 MB."}
            </small>
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
            <input
              type="file"
              name="backgroundImage"
              accept="image/jpeg,image/png,image/webp,image/avif"
            />
            <small>
              {sheet?.backgroundImageUrl
                ? "Envie apenas para substituir o fundo atual."
                : "Imagem horizontal recomendada."}
            </small>
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
            <input
              type="color"
              name="primaryColor"
              defaultValue={sheet?.primaryColor ?? campaign.primaryColor}
            />
          </label>
          <label>
            <span>Cor secundária</span>
            <input
              type="color"
              name="secondaryColor"
              defaultValue={sheet?.secondaryColor ?? campaign.secondaryColor}
            />
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
          <span className="attribute-submit-hint" role="status">
            Distribua os {attributeBudget} pontos para liberar o salvamento.
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
