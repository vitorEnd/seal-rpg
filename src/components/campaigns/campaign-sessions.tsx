import Image from "next/image";
import Link from "next/link";

import type { CampaignExperienceView } from "@/application/campaigns/campaign-read-repository";
import { formatDateTime } from "@/components/campaigns/campaign-presenters";
import { resolveCampaignChapterProgression } from "@/domain/chapter-progression";
import type { CampaignSession, User } from "@/domain/entities";
import { canManageCampaign } from "@/domain/permissions";

import styles from "./campaign-sessions.module.css";

function SessionMoment({
  value,
}: {
  value: CampaignSession["scheduledAt"] | CampaignSession["occurredAt"];
}) {
  return value ? (
    <time dateTime={value}>{formatDateTime(value)}</time>
  ) : (
    <span>A definir</span>
  );
}

export function CampaignSessions({
  experience,
  user,
}: {
  experience: CampaignExperienceView;
  user: User;
}) {
  const membership =
    experience.members.find((member) => member.membership.userId === user.id)
      ?.membership ?? null;
  const canManage = canManageCampaign(user, experience.campaign, membership);
  const openTableSession = experience.openTableSessionId
    ? experience.sessions.find(
        (session) => session.id === experience.openTableSessionId,
      ) ?? null
    : null;
  const completed = experience.sessions
    .filter((session) => session.status === "completed")
    .sort((left, right) =>
      (left.occurredAt ?? left.createdAt).localeCompare(
        right.occurredAt ?? right.createdAt,
      ),
    );
  const scheduled = experience.sessions
    .filter(
      (session) =>
        session.status === "scheduled" &&
        session.id !== experience.openTableSessionId,
    )
    .sort((left, right) =>
      (left.scheduledAt ?? left.createdAt).localeCompare(
        right.scheduledAt ?? right.createdAt,
      ),
    );
  const chapterProgress = resolveCampaignChapterProgression(experience.chapters);
  const currentChapter = chapterProgress.currentChapter;
  const visualImageUrl =
    currentChapter?.backgroundImageUrl ??
    experience.campaign.backgroundImageUrl ??
    experience.campaign.coverImageUrl;
  const latestCompleted = completed.at(-1) ?? null;

  return (
    <section
      className={`campaign-content-section ${styles.sessionsSection}`}
      aria-labelledby="sessions-title"
    >
      <header className="campaign-section-heading">
        <div>
          <p className="campaign-kicker">Diário da mesa</p>
          <h2 id="sessions-title">Sessões</h2>
          <p className="section-intro">
            Acompanhe a operação em ordem cronológica. Um registro só é marcado
            como realizado depois que o mestre conclui a sessão.
          </p>
        </div>
        {user.role === "admin" ? (
          <Link href="/admin?view=sessions" className="campaign-text-link">
            Gerenciar sessões
          </Link>
        ) : null}
      </header>

      <article className={styles.visualArchive} aria-label="Arquivo visual da campanha">
        <div className={styles.visualArt}>
          {visualImageUrl ? (
            <Image
              src={visualImageUrl}
              alt=""
              fill
              unoptimized={visualImageUrl.startsWith("/media/")}
              sizes="(max-width: 800px) 100vw, 62vw"
              className={styles.visualImage}
            />
          ) : (
            <div className={styles.visualPlaceholder} aria-hidden="true" />
          )}
          <div className={styles.visualShade} aria-hidden="true" />
          <span className={styles.visualCoordinates} aria-hidden="true">
            OP.NEP // REGISTRO VISUAL
          </span>
        </div>
        <div className={styles.visualCopy}>
          <p className="campaign-kicker">Capítulo em curso</p>
          <h3>{currentChapter?.title ?? "Aguardando publicação"}</h3>
          <p>
            {currentChapter?.shortDescription ||
              "O primeiro capítulo aparecerá aqui assim que for publicado pelo mestre."}
          </p>
          <dl>
            <div>
              <dt>Registros concluídos</dt>
              <dd>{completed.length.toString().padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>Última atualização</dt>
              <dd>
                {latestCompleted
                  ? `Sessão ${latestCompleted.sessionNumber}`
                  : "Sem sessão"}
              </dd>
            </div>
          </dl>
        </div>
      </article>

      {openTableSession ? (
        <aside className="live-table-callout">
          <div>
            <span aria-hidden="true" />
            <p className="campaign-kicker">Mesa ao vivo</p>
            <h3>
              Sessão {openTableSession.sessionNumber.toString().padStart(2, "0")} ·{" "}
              {openTableSession.title}
            </h3>
            <p>O mapa, os tokens e as rolagens estão sendo compartilhados agora.</p>
          </div>
          <Link
            href={`/campaigns/${encodeURIComponent(experience.campaign.slug)}/table`}
            className="campaign-primary-button"
          >
            Entrar na mesa
          </Link>
        </aside>
      ) : (
        <aside className="table-waiting-callout">
          <div>
            <p className="campaign-kicker">Mesa virtual</p>
            <strong>
              {canManage
                ? "Pronta para a próxima sessão."
                : "Aguardando o mestre abrir a sessão."}
            </strong>
          </div>
          <Link
            href={`/campaigns/${encodeURIComponent(experience.campaign.slug)}/table`}
            className="campaign-text-link"
          >
            {canManage ? "Abrir sala da mesa →" : "Ir para a sala de espera →"}
          </Link>
        </aside>
      )}

      {!completed.length ? (
        <div className={styles.emptyRecord} role="status">
          <span aria-hidden="true">00</span>
          <div>
            <p className="campaign-kicker">Nenhum registro concluído</p>
            <h3>Ainda não houve nenhuma sessão nesta campanha.</h3>
            <p>
              Quando a mesa começar, acontecimentos e consequências serão
              arquivados aqui sem criar um histórico de exemplo.
            </p>
          </div>
        </div>
      ) : null}

      <section className={styles.timelineSection} aria-labelledby="session-timeline-title">
        <header className={styles.timelineHeading}>
          <div>
            <p className="campaign-kicker">Cronologia operacional</p>
            <h3 id="session-timeline-title">Linha do tempo</h3>
          </div>
          <span>
            {completed.length + scheduled.length + (openTableSession ? 1 : 0)} registros
          </span>
        </header>

        <ol className={styles.timeline}>
          {completed.map((session) => (
            <li key={session.id} className={styles.completedItem}>
              <div className={styles.timelineMarker} aria-hidden="true">
                <span>✓</span>
              </div>
              <article className={styles.timelineCard}>
                <div className={styles.timelineMeta}>
                  <span>
                    Concluída · Sessão {session.sessionNumber.toString().padStart(2, "0")}
                  </span>
                  <SessionMoment value={session.occurredAt ?? session.createdAt} />
                </div>
                <h4>{session.title}</h4>
                <p>{session.summary || session.description}</p>
                {session.events || session.consequences ? (
                  <div className={styles.sessionDetails}>
                    {session.events ? (
                      <div>
                        <strong>Acontecimentos</strong>
                        <p>{session.events}</p>
                      </div>
                    ) : null}
                    {session.consequences ? (
                      <div>
                        <strong>Consequências</strong>
                        <p>{session.consequences}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            </li>
          ))}

          {openTableSession ? (
            <li className={styles.liveItem}>
              <div className={styles.timelineMarker} aria-hidden="true">
                <span />
              </div>
              <article className={styles.timelineCard}>
                <div className={styles.timelineMeta}>
                  <span>
                    Em andamento · Sessão {openTableSession.sessionNumber.toString().padStart(2, "0")}
                  </span>
                  <span>Agora</span>
                </div>
                <h4>{openTableSession.title}</h4>
                <p>
                  {openTableSession.description ||
                    "A equipe está reunida na mesa virtual."}
                </p>
                <Link
                  href={`/campaigns/${encodeURIComponent(experience.campaign.slug)}/table`}
                  className={styles.timelineAction}
                >
                  Entrar na sessão →
                </Link>
              </article>
            </li>
          ) : null}

          {scheduled.map((session) => (
            <li key={session.id} className={styles.scheduledItem}>
              <div className={styles.timelineMarker} aria-hidden="true">
                <span>{session.sessionNumber.toString().padStart(2, "0")}</span>
              </div>
              <article className={styles.timelineCard}>
                <div className={styles.timelineMeta}>
                  <span>
                    Agendada · Sessão {session.sessionNumber.toString().padStart(2, "0")}
                  </span>
                  <SessionMoment value={session.scheduledAt} />
                </div>
                <h4>{session.title}</h4>
                <p>
                  {session.description ||
                    "Os detalhes serão liberados pelo mestre."}
                </p>
              </article>
            </li>
          ))}

          {chapterProgress.nextChapter ? (
            <li className={styles.lockedItem}>
              <div className={styles.timelineMarker} aria-hidden="true">
                <span>◇</span>
              </div>
              <article
                className={styles.timelineCard}
                aria-label="Próximo capítulo não desbloqueado"
              >
                <div className={styles.timelineMeta}>
                  <span>Próximo capítulo</span>
                  <span>Classificado</span>
                </div>
                <h4>Não desbloqueado</h4>
                <p>
                  O próximo capítulo será revelado pelo mestre quando a equipe
                  avançar na operação.
                </p>
                <span className={styles.lockedBadge}>Acesso bloqueado</span>
              </article>
            </li>
          ) : null}
        </ol>
      </section>
    </section>
  );
}
