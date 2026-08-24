import Image from "next/image";
import Link from "next/link";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveCampaignChapterProgression } from "@/domain/chapter-progression";
import type { User } from "@/domain/entities";

export function CampaignChapters({
  experience,
  user,
}: {
  experience: CampaignExperienceView;
  user: User;
}) {
  const chapters = experience.chapters.filter(
    (chapter) => chapter.status === "published" || user.role === "admin",
  );
  const progression = resolveCampaignChapterProgression(experience.chapters);
  const progressByChapterId = new Map(
    progression.entries.map((entry) => [entry.chapter.id, entry.state]),
  );

  return (
    <section className="campaign-content-section" aria-labelledby="chapters-title">
      <header className="campaign-section-heading">
        <div>
          <p className="campaign-kicker">Arquivo narrativo</p>
          <h2 id="chapters-title">Capítulos da campanha</h2>
        </div>
        <div className="campaign-heading-aside">
          <span>{chapters.length.toString().padStart(2, "0")}</span>
          <p>capítulos cadastrados</p>
        </div>
      </header>

      {chapters.length ? (
        <div className="chapter-list">
          {chapters.map((chapter) => {
            const progressState =
              chapter.status === "draft"
                ? "draft"
                : progressByChapterId.get(chapter.id) ?? "locked";
            const isLocked = progressState === "locked";
            const isAvailable = progressState === "available";
            const isCompleted = progressState === "completed";

            return (
              <article
                key={chapter.id}
                className={`chapter-card chapter-card-${progressState}`}
                aria-label={
                  isLocked
                    ? `Capítulo ${chapter.order.toString().padStart(2, "0")} bloqueado`
                    : undefined
                }
              >
              <div className="chapter-art">
                {isLocked ? (
                  <div className="chapter-classified-art" aria-hidden="true" />
                ) : chapter.backgroundImageUrl ? (
                  <Image
                    src={chapter.backgroundImageUrl}
                    alt=""
                    fill
                    unoptimized={chapter.backgroundImageUrl.startsWith("/media/")}
                    sizes="(min-width: 1024px) 1100px, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="chapter-placeholder" aria-hidden="true" />
                )}
                <div className="chapter-art-overlay" />
                <span className="chapter-number" aria-hidden="true">
                  {chapter.order.toString().padStart(2, "0")}
                </span>
                {chapter.status === "draft" ? (
                  <span className="chapter-draft">Rascunho</span>
                ) : null}
                {isCompleted ? (
                  <span className="chapter-progress-badge">Concluído</span>
                ) : null}
                {isAvailable ? (
                  <span className="chapter-progress-badge current">Em curso</span>
                ) : null}
                {isLocked ? (
                  <div className="chapter-lock" aria-hidden="true">
                    <span className="chapter-lock-icon"><i /></span>
                    <strong>Acesso bloqueado</strong>
                  </div>
                ) : null}
              </div>
              <div className="chapter-copy">
                <p className="campaign-kicker">Capítulo {chapter.order.toString().padStart(2, "0")}</p>
                <h3>{isLocked ? "Não desbloqueado" : chapter.title}</h3>
                {isLocked ? (
                  <div className="chapter-classified-copy">
                    <p className="chapter-lead">Conteúdo classificado.</p>
                    <p>
                      Conclua o capítulo anterior para liberar a imagem, o briefing e o acesso à mesa desta etapa.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="chapter-lead">{chapter.shortDescription}</p>
                    <p>{chapter.description}</p>
                  </>
                )}
                <div className="chapter-actions">
                  {isAvailable ? (
                    <Link
                      href={`/campaigns/${encodeURIComponent(experience.campaign.slug)}/table`}
                      className="campaign-primary-button"
                    >
                      {experience.openTableSessionId ? "Entrar na mesa" : "Ir para a mesa"}
                      <small>
                        {experience.openTableSessionId
                          ? "Sessão compartilhada aberta"
                          : "Mapa 2D · aguardar o mestre"}
                      </small>
                    </Link>
                  ) : isCompleted ? (
                    <span className="chapter-completed-note">Etapa concluída</span>
                  ) : isLocked ? (
                    <span className="chapter-locked-note">Finalize a etapa anterior</span>
                  ) : null}
                  {user.role === "admin" ? (
                    <Link href="/admin?view=chapters" className="campaign-text-link">
                      Editar capítulo no admin
                    </Link>
                  ) : null}
                </div>
              </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          eyebrow="Nenhum capítulo publicado"
          title="A história ainda está sendo preparada."
          description="Quando o administrador publicar o primeiro capítulo, ele aparecerá aqui automaticamente."
          action={user.role === "admin" ? { label: "Adicionar capítulo", href: "/admin?view=chapters" } : undefined}
        />
      )}

      <aside className="play-module" aria-labelledby="play-title">
        <div>
          <p className="campaign-kicker">Módulo de jogo</p>
          <h3 id="play-title">Mesa tática compartilhada</h3>
          <p>
            {progression.currentChapter
              ? `Capítulo em curso: ${progression.currentChapter.title}. Abra o mapa 2D, mova seu personagem e acompanhe a equipe em tempo real.`
              : progression.isComplete
                ? "Todos os capítulos publicados foram concluídos. O histórico da operação continua disponível nas sessões."
                : "A mesa será liberada assim que o primeiro capítulo for publicado pelo mestre."}
          </p>
        </div>
        {progression.currentChapter ? (
          <Link
            href={`/campaigns/${encodeURIComponent(experience.campaign.slug)}/table`}
            className="campaign-text-link"
          >
            {experience.openTableSessionId ? "Mesa aberta agora →" : "Acessar sala de espera →"}
          </Link>
        ) : (
          <span className="chapter-completed-note">
            {progression.isComplete ? "Operação concluída" : "Aguardando publicação"}
          </span>
        )}
      </aside>
    </section>
  );
}
