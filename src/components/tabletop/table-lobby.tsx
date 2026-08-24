"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { openVirtualTableAction } from "@/app/campaigns/[slug]/table/actions";

export function TableLobby({
  campaign,
  viewerName,
  canManage,
  scheduledSessions,
}: {
  campaign: {
    name: string;
    slug: string;
    backgroundImageUrl: string | null;
  };
  viewerName: string;
  canManage: boolean;
  scheduledSessions: Array<{
    id: string;
    sessionNumber: number;
    title: string;
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(
    scheduledSessions[0]?.id ?? "",
  );

  useEffect(() => {
    let cancelled = false;
    let timeout = 0;

    const checkForTable = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(
            `/api/campaigns/${encodeURIComponent(campaign.slug)}/table`,
            { cache: "no-store" },
          );
          if ([401, 403, 404].includes(response.status)) {
            router.refresh();
            return;
          }
          if (response.ok && response.status !== 204) {
            const data = (await response.json()) as { snapshot: unknown | null };
            if (!cancelled && data.snapshot) {
              router.refresh();
              return;
            }
          }
        } catch {
          // The next scheduled check will retry without interrupting the lobby.
        }
      }
      if (!cancelled) timeout = window.setTimeout(checkForTable, 2200);
    };

    timeout = window.setTimeout(checkForTable, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [campaign.slug, router]);

  const openTable = () => {
    setFeedback("");
    startTransition(async () => {
      const result = await openVirtualTableAction(
        campaign.slug,
        selectedSessionId || undefined,
      );
      setFeedback(result.message);
      if (result.ok) router.refresh();
    });
  };

  const backgroundImage =
    campaign.slug === "operacao-neptune"
      ? "/art/maps/neptune-cargo-ship-main-deck.png"
      : campaign.backgroundImageUrl;

  return (
    <main className="vtt-lobby">
      <div className="vtt-lobby-media" aria-hidden="true">
        {backgroundImage ? (
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            unoptimized={backgroundImage.startsWith("/media/")}
            sizes="100vw"
            className="object-cover"
          />
        ) : null}
        <div />
      </div>

      <header className="vtt-lobby-header">
        <Link href={`/campaigns/${encodeURIComponent(campaign.slug)}`}>
          <span aria-hidden="true">←</span> Voltar ao arquivo
        </Link>
        <p>{campaign.name}</p>
      </header>

      <section className="vtt-lobby-card" aria-labelledby="table-lobby-title">
        <p className="campaign-kicker">Canal da mesa · aguardando sessão</p>
        <h1 id="table-lobby-title">
          {canManage ? "A mesa está pronta para abrir." : "Aguardando o mestre."}
        </h1>
        <p>
          {canManage
            ? "Ao abrir, uma sessão agendada será usada. Se ainda não houver nenhuma, a primeira sessão real será criada agora — sem conteúdo fictício."
            : `${viewerName}, você entrará automaticamente assim que o mestre iniciar a sessão compartilhada.`}
        </p>

        <div className="vtt-lobby-status">
          <i aria-hidden="true" />
          <span>{canManage ? "Comando autorizado" : "Escutando o canal da campanha"}</span>
        </div>

        {canManage && scheduledSessions.length ? (
          <label className="vtt-lobby-session-picker">
            <span>Sessão que será aberta</span>
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
            >
              {scheduledSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  Sessão {session.sessionNumber.toString().padStart(2, "0")} ·{" "}
                  {session.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {canManage ? (
          <button
            type="button"
            className="vtt-primary-action"
            disabled={pending}
            onClick={openTable}
          >
            {pending ? "Abrindo canal..." : "Abrir mesa da sessão"}
          </button>
        ) : null}
        {feedback ? (
          <p className="vtt-lobby-feedback" role="status" aria-live="polite">
            {feedback}
          </p>
        ) : null}
      </section>
    </main>
  );
}
