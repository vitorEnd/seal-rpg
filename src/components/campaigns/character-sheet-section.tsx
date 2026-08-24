import Image from "next/image";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import { CharacterSheetForm } from "@/components/campaigns/character-sheet-form";
import { formatDate } from "@/components/campaigns/campaign-presenters";
import {
  CHARACTER_ATTRIBUTE_DEFINITIONS,
  EMPTY_CHARACTER_ATTRIBUTES,
  calculateEffectiveAttributes,
} from "@/domain/character-attributes";
import type { User } from "@/domain/entities";

export function CharacterSheetSection({
  experience,
  user,
}: {
  experience: CampaignExperienceView;
  user: User;
}) {
  const statusOptions = experience.characterStatusOptions;
  const classOptions = experience.characterClassOptions;
  const statusesById = new Map(
    experience.characterStatusOptions.map((option) => [option.id, option]),
  );
  const classesById = new Map(
    experience.characterClassOptions.map((option) => [option.id, option]),
  );
  const editableSheets = experience.characters.filter(
    (sheet) => user.role === "admin" || sheet.userId === user.id,
  );

  return (
    <section className="campaign-content-section" aria-labelledby="sheet-title">
      <header className="campaign-section-heading">
        <div>
          <p className="campaign-kicker">Arquivo de operador</p>
          <h2 id="sheet-title">Ficha</h2>
          <p className="section-intro">
            Crie sua identidade, escolha uma classe liberada pelo administrador e importe as imagens que vão representar o personagem.
          </p>
        </div>
        <div className="campaign-heading-aside">
          <span>{experience.characters.length.toString().padStart(2, "0")}</span>
          <p>fichas na campanha</p>
        </div>
      </header>

      {experience.characters.length ? (
        <div className="sheet-gallery" aria-label="Fichas criadas">
          {experience.characters.map((sheet) => {
            const status = statusesById.get(sheet.statusOptionId);
            const characterClass = classesById.get(sheet.classOptionId);
            const classBonuses =
              characterClass?.attributeBonuses ?? EMPTY_CHARACTER_ATTRIBUTES;
            const effectiveAttributes = calculateEffectiveAttributes(
              sheet.attributes,
              classBonuses,
            );
            return (
              <article key={sheet.id} className="sheet-card">
                <div className="sheet-card-art">
                  {sheet.coverImageUrl ? (
                    <Image
                      src={sheet.coverImageUrl}
                      alt={`Capa da ficha de ${sheet.name}`}
                      fill
                      unoptimized={sheet.coverImageUrl.startsWith("/media/")}
                      sizes="(min-width: 1024px) 28vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{sheet.name.slice(0, 2).toLocaleUpperCase("pt-BR")}</span>
                  )}
                  <div className="sheet-card-shade" />
                </div>
                <div className="sheet-card-copy">
                  <div className="sheet-card-meta">
                    <span style={{ borderColor: status?.color ?? sheet.primaryColor }}>
                      {status?.name ?? "Status indisponível"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {characterClass?.logoImageUrl ? (
                        <Image
                          src={characterClass.logoImageUrl}
                          alt=""
                          width={20}
                          height={20}
                          unoptimized={characterClass.logoImageUrl.startsWith("/media/")}
                          className="h-5 w-5 object-cover"
                        />
                      ) : null}
                      {characterClass?.name ?? "Classe indisponível"}
                    </span>
                  </div>
                  <h3>{sheet.name}</h3>
                  <p>{sheet.shortDescription}</p>
                  <div
                    className="mt-5 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-3"
                    role="group"
                    aria-label={`Atributos efetivos de ${sheet.name}`}
                  >
                    {CHARACTER_ATTRIBUTE_DEFINITIONS.map(({ key, label }) => (
                      <div
                        key={key}
                        className="grid min-w-0 gap-1 bg-[#0d1114] p-2.5"
                      >
                        <span className="truncate font-mono text-[.5rem] uppercase tracking-[.08em] text-zinc-500">
                          {label}
                        </span>
                        <div className="flex items-end justify-between gap-2">
                          <strong className="text-lg leading-none text-zinc-100">
                            {effectiveAttributes[key]}
                          </strong>
                          {classBonuses[key] > 0 ? (
                            <small className="font-mono text-[.48rem] uppercase text-orange-300">
                              +{classBonuses[key]} classe
                            </small>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <dl>
                    <div><dt>Gênero</dt><dd>{sheet.gender}</dd></div>
                    <div><dt>Início</dt><dd>{formatDate(sheet.startDate)}</dd></div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="sheet-empty-state">
          <span>00</span>
          <div>
            <p className="campaign-kicker">Nenhuma ficha importada</p>
            <h3>O esquadrão ainda não foi montado.</h3>
            <p>Preencha o formulário abaixo. Assim que você salvar, a ficha aparecerá automaticamente nesta tela.</p>
          </div>
        </div>
      )}

      <div className="sheet-editor-stack">
        {editableSheets.map((sheet) => (
          <details key={sheet.id} className="sheet-editor-disclosure">
            <summary>Editar ficha · {sheet.name}</summary>
            <CharacterSheetForm
              campaign={experience.campaign}
              statusOptions={statusOptions}
              classOptions={classOptions}
              sheet={sheet}
            />
          </details>
        ))}
        <details className="sheet-editor-disclosure" open={!editableSheets.length}>
          <summary>Criar nova ficha</summary>
          <CharacterSheetForm
            campaign={experience.campaign}
            statusOptions={statusOptions}
            classOptions={classOptions}
          />
        </details>
      </div>
    </section>
  );
}
