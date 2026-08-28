"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type { TabletopSnapshot, TabletopTokenView } from "@/application/tabletop/tabletop-read-repository";
import {
  activateVirtualTableMapAction,
  advanceVirtualTableChapterAction,
  closeVirtualTableAction,
  createVirtualTableTokenAction,
  deleteVirtualTableMapAction,
  deleteVirtualTableTokenAction,
  moveVirtualTableTokenAction,
  resetVirtualTableMapAction,
  rollVirtualTableDiceAction,
  toggleVirtualTableTokenAction,
  updateCharacterLoadoutAction,
  updateVirtualTableTokenAction,
  updateVirtualTableMapAction,
  type TabletopCommandResult,
} from "@/app/campaigns/[slug]/table/actions";
import { campaignThemeStyle } from "@/components/campaigns/campaign-presenters";
import { TacticalScrambleText } from "@/components/effects/tactical-scramble-text";
import {
  connectTabletopRealtime,
  type TabletopRealtimeConnection,
  type TabletopRealtimeStatus,
} from "@/infrastructure/supabase/tabletop-realtime";

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1067;
const MIN_ZOOM = 0.16;
const MAX_ZOOM = 4.8;
const DICE_SHORTCUTS = [20, 12, 10, 100, 8, 6, 4] as const;

const rollTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

type CameraState = { x: number; y: number; scale: number };
type SyncStatus = "synced" | "syncing" | "offline";
type ModalName = "token" | "token-edit" | "map" | "character" | "chapter" | null;
type CommandOptions = {
  closeModal?: boolean;
  optimisticTokenId?: string;
};

type TokenPositionStyle = CSSProperties & {
  "--token-size": string;
  "--token-accent": string;
  "--vision-height": string;
  "--vision-width": string;
  "--vision-rotation": string;
  "--vision-color": string;
};

interface DiceAnimation {
  id: string;
  actorName: string;
  expression: string;
  total: number;
}

interface ChapterTransitionAnimation {
  id: string;
  title: string;
  order: number;
  mapName: string;
  completed: boolean;
}

interface TokenDragState {
  pointerId: number;
  tokenId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

interface MapPanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCameraX: number;
  startCameraY: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function tokenKindLabel(kind: TabletopTokenView["kind"]): string {
  if (kind === "character") return "Personagem";
  if (kind === "npc") return "NPC";
  if (kind === "enemy") return "Inimigo";
  return "Objeto";
}

function tokenFallback(kind: TabletopTokenView["kind"]): string {
  if (kind === "character") return "PC";
  if (kind === "npc") return "NPC";
  if (kind === "enemy") return "X";
  return "OBJ";
}

function dispositionLabel(disposition: TabletopTokenView["disposition"]): string {
  if (disposition === "player") return "Operador";
  if (disposition === "ally") return "Aliado";
  if (disposition === "hostile") return "Hostil";
  if (disposition === "object") return "Objeto";
  return "Neutro";
}

function mapScaleLabel(scale: TabletopSnapshot["maps"][number]["scale"]): string {
  if (scale === "huge") return "Muito grande";
  if (scale === "large") return "Grande";
  return "Médio";
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function TableModal({
  eyebrow = "Controle da mesa",
  title,
  description,
  onClose,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="vtt-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="vtt-dialog-panel">
        <header>
          <div>
            <p>{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
            <span id={descriptionId}>{description}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar janela">
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

function LoadoutList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

export function VirtualTable({
  initialSnapshot,
  viewer,
  canManage,
}: {
  initialSnapshot: TabletopSnapshot;
  viewer: { id: string; name: string; username: string };
  canManage: boolean;
}) {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(initialSnapshot.table.revision);
  const tokenDragRef = useRef<TokenDragState | null>(null);
  const pendingMoveIdsRef = useRef(new Set<string>());
  const refreshSequenceRef = useRef(0);
  const refreshRequestRef = useRef<{
    id: number;
    controller: AbortController;
  } | null>(null);
  const realtimeConnectionRef = useRef<TabletopRealtimeConnection | null>(null);
  const tokenPreviewRef = useRef<{
    lastSentAt: number;
    timer: number | null;
    pending: { tokenId: string; x: number; y: number } | null;
  }>({ lastSentAt: 0, timer: null, pending: null });
  const mapPanRef = useRef<MapPanState | null>(null);
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 0.5 });
  const lastAnimatedRollRef = useRef(initialSnapshot.rolls[0]?.id ?? null);
  const diceAnimationTimerRef = useRef<number | null>(null);
  const lastChapterTransitionIdRef = useRef(
    initialSnapshot.chapterProgress.transition?.id ?? null,
  );
  const chapterAnimationTimerRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [camera, setCamera] = useState<CameraState>({
    x: 0,
    y: 0,
    scale: 0.5,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [realtimeStatus, setRealtimeStatus] =
    useState<TabletopRealtimeStatus>("connecting");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [mapLibraryOpen, setMapLibraryOpen] = useState(true);
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [diceAnimation, setDiceAnimation] = useState<DiceAnimation | null>(null);
  const [chapterTransition, setChapterTransition] =
    useState<ChapterTransitionAnimation | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const synchronizedChapterTransition = snapshot.chapterProgress.transition;

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const newestRoll = snapshot.rolls[0];
    if (!newestRoll || newestRoll.id === lastAnimatedRollRef.current) return;
    lastAnimatedRollRef.current = newestRoll.id;
    setDiceAnimation({
      id: newestRoll.id,
      actorName: newestRoll.actorName,
      expression: newestRoll.expression,
      total: newestRoll.total,
    });
    if (diceAnimationTimerRef.current) {
      window.clearTimeout(diceAnimationTimerRef.current);
    }
    diceAnimationTimerRef.current = window.setTimeout(() => {
      setDiceAnimation(null);
      diceAnimationTimerRef.current = null;
    }, 1900);
  }, [snapshot.rolls]);

  useEffect(
    () => () => {
      if (diceAnimationTimerRef.current) {
        window.clearTimeout(diceAnimationTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const transition = synchronizedChapterTransition;
    if (!transition || transition.id === lastChapterTransitionIdRef.current) {
      return;
    }
    lastChapterTransitionIdRef.current = transition.id;
    const targetChapter = transition.to;

    setChapterTransition({
      id: transition.id,
      title: targetChapter?.title ?? "Operação concluída",
      order: targetChapter?.order ?? transition.from.order,
      mapName: transition.mapName,
      completed: targetChapter === null,
    });
    setAnnouncement(
      targetChapter
        ? `Capítulo ${targetChapter.order}, ${targetChapter.title}, iniciado em ${transition.mapName}.`
        : `${transition.from.title} concluído. Todos os capítulos publicados foram finalizados.`,
    );
    if (chapterAnimationTimerRef.current) {
      window.clearTimeout(chapterAnimationTimerRef.current);
    }
    chapterAnimationTimerRef.current = window.setTimeout(() => {
      setChapterTransition(null);
      chapterAnimationTimerRef.current = null;
    }, 3800);
  }, [synchronizedChapterTransition]);

  useEffect(
    () => () => {
      if (chapterAnimationTimerRef.current) {
        window.clearTimeout(chapterAnimationTimerRef.current);
      }
    },
    [],
  );

  const refreshSnapshot = useCallback(
    async () => {
      const requestId = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = requestId;
      refreshRequestRef.current?.controller.abort();
      const controller = new AbortController();
      refreshRequestRef.current = { id: requestId, controller };
      setSyncStatus("syncing");
      try {
        const response = await fetch(
          `/api/campaigns/${encodeURIComponent(initialSnapshot.campaign.slug)}/table`,
          { cache: "no-store", signal: controller.signal },
        );
        if (refreshRequestRef.current?.id !== requestId) return;
        if ([401, 403, 404].includes(response.status)) {
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error("TABLE_SYNC_FAILED");
        const data = (await response.json()) as {
          snapshot: TabletopSnapshot | null;
        };
        if (refreshRequestRef.current?.id !== requestId) return;
        if (!data.snapshot) {
          router.refresh();
          return;
        }
        const nextSnapshot = data.snapshot;
        if (nextSnapshot.table.id !== initialSnapshot.table.id) {
          router.refresh();
          return;
        }
        if (nextSnapshot.table.revision < revisionRef.current) {
          setSyncStatus("synced");
          return;
        }
        revisionRef.current = nextSnapshot.table.revision;
        setSnapshot((current) => {
          const activeDrag = tokenDragRef.current;
          const preservedIds = new Set(pendingMoveIdsRef.current);
          if (activeDrag) preservedIds.add(activeDrag.tokenId);
          if (!preservedIds.size) return nextSnapshot;
          const localTokens = new Map(
            current.tokens
              .filter((token) => preservedIds.has(token.id))
              .map((token) => [token.id, token]),
          );
          return {
            ...nextSnapshot,
            tokens: nextSnapshot.tokens.map(
              (token) => localTokens.get(token.id) ?? token,
            ),
          };
        });
        setSyncStatus("synced");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (refreshRequestRef.current?.id === requestId) {
          setSyncStatus("offline");
        }
      } finally {
        if (refreshRequestRef.current?.id === requestId) {
          refreshRequestRef.current = null;
        }
      }
    },
    [initialSnapshot.campaign.slug, initialSnapshot.table.id, router],
  );

  useEffect(() => {
    let invalidationTimer = 0;
    let requestedRevision = revisionRef.current;
    const connection = connectTabletopRealtime({
      tableId: initialSnapshot.table.id,
      viewer,
      onInvalidated(revision) {
        if (revision <= revisionRef.current || revision <= requestedRevision) return;
        requestedRevision = revision;
        window.clearTimeout(invalidationTimer);
        invalidationTimer = window.setTimeout(() => {
          void refreshSnapshot();
        }, 45);
      },
      onTokenPreview(preview) {
        const activeDrag = tokenDragRef.current;
        if (
          activeDrag?.tokenId === preview.tokenId ||
          pendingMoveIdsRef.current.has(preview.tokenId)
        ) {
          return;
        }
        setSnapshot((current) => ({
          ...current,
          tokens: current.tokens.map((token) =>
            token.id === preview.tokenId
              ? { ...token, x: preview.x, y: preview.y }
              : token,
          ),
        }));
      },
      onPresence(onlineIds) {
        setOnlineUserIds(onlineIds);
      },
      onStatus(status) {
        setRealtimeStatus(status);
      },
    });
    realtimeConnectionRef.current = connection;
    if (!connection.available) setRealtimeStatus("disconnected");

    return () => {
      window.clearTimeout(invalidationTimer);
      if (realtimeConnectionRef.current === connection) {
        realtimeConnectionRef.current = null;
      }
      connection.disconnect();
      const preview = tokenPreviewRef.current;
      if (preview.timer) window.clearTimeout(preview.timer);
      preview.timer = null;
      preview.pending = null;
    };
  }, [
    initialSnapshot.table.id,
    refreshSnapshot,
    viewer.id,
    viewer.name,
    viewer.username,
  ]);

  useEffect(() => {
    let cancelled = false;
    let timeout = 0;

    const poll = async () => {
      if (document.visibilityState === "visible") {
        await refreshSnapshot();
      }
      if (!cancelled) {
        timeout = window.setTimeout(
          poll,
          realtimeStatus === "connected" ? 12_000 : 2_200,
        );
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshSnapshot();
    };

    timeout = window.setTimeout(
      poll,
      realtimeStatus === "connected" ? 12_000 : 1_200,
    );
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
      refreshRequestRef.current?.controller.abort();
    };
  }, [realtimeStatus, refreshSnapshot]);

  const fitMap = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const scale = clamp(
      Math.min(bounds.width / WORLD_WIDTH, bounds.height / WORLD_HEIGHT) * 0.965,
      MIN_ZOOM,
      1,
    );
    const next = {
      x: (bounds.width - WORLD_WIDTH * scale) / 2,
      y: (bounds.height - WORLD_HEIGHT * scale) / 2,
      scale,
    };
    cameraRef.current = next;
    setCamera(next);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resizeObserver = new ResizeObserver(fitMap);
    resizeObserver.observe(viewport);
    fitMap();
    return () => resizeObserver.disconnect();
  }, [fitMap]);

  useEffect(() => {
    fitMap();
  }, [fitMap, snapshot.table.activeMapId]);

  const applyCommandResult = useCallback(
    async (result: TabletopCommandResult, options?: CommandOptions) => {
      setNotice({ ok: result.ok, message: result.message });
      setAnnouncement(result.message);
      if (result.roll) {
        setSnapshot((current) => ({
          ...current,
          rolls: [
            result.roll!,
            ...current.rolls.filter((roll) => roll.id !== result.roll?.id),
          ].slice(0, 30),
        }));
      }
      if (result.ok) {
        if (options?.closeModal) setModal(null);
      }
      // A forced read also rolls back an optimistic token move if the server
      // rejects it because ownership or table state changed mid-drag.
      await refreshSnapshot();
    },
    [refreshSnapshot],
  );

  const executeCommand = async (
    actionName: string,
    command: Promise<TabletopCommandResult>,
    options?: CommandOptions,
  ) => {
    setPendingAction(actionName);
    setNotice(null);
    if (options?.optimisticTokenId) {
      pendingMoveIdsRef.current.add(options.optimisticTokenId);
    }
    try {
      const result = await command;
      if (options?.optimisticTokenId && !result.ok) {
        pendingMoveIdsRef.current.delete(options.optimisticTokenId);
      }
      await applyCommandResult(result, options);
      if (options?.optimisticTokenId) {
        pendingMoveIdsRef.current.delete(options.optimisticTokenId);
      }
    } catch {
      if (options?.optimisticTokenId) {
        pendingMoveIdsRef.current.delete(options.optimisticTokenId);
      }
      setNotice({ ok: false, message: "A conexão com a mesa foi interrompida." });
      setAnnouncement("A conexão com a mesa foi interrompida.");
      await refreshSnapshot();
    } finally {
      if (options?.optimisticTokenId) {
        pendingMoveIdsRef.current.delete(options.optimisticTokenId);
      }
      setPendingAction(null);
    }
  };

  const updateLocalToken = (tokenId: string, x: number, y: number) => {
    setSnapshot((current) => ({
      ...current,
      tokens: current.tokens.map((token) =>
        token.id === tokenId ? { ...token, x, y } : token,
      ),
    }));
  };

  const canControlToken = (token: TabletopTokenView) =>
    canManage || token.controllerUserId === viewer.id;

  const finishTokenDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = tokenDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    tokenDragRef.current = null;
    setDraggingTokenId(null);
    void executeCommand(
      `move:${drag.tokenId}`,
      moveVirtualTableTokenAction({
        campaignSlug: snapshot.campaign.slug,
        tableId: snapshot.table.id,
        tokenId: drag.tokenId,
        x: drag.lastX,
        y: drag.lastY,
      }),
      { optimisticTokenId: drag.tokenId },
    );
  };

  const moveTokenWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    token: TabletopTokenView,
  ) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (
      !direction ||
      !canControlToken(token) ||
      pendingMoveIdsRef.current.has(token.id)
    ) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 0.025 : 0.0075;
    const x = clamp(token.x + direction[0] * step, 0.015, 0.985);
    const y = clamp(token.y + direction[1] * step, 0.015, 0.985);
    updateLocalToken(token.id, x, y);
    void executeCommand(
      `move:${token.id}`,
      moveVirtualTableTokenAction({
        campaignSlug: snapshot.campaign.slug,
        tableId: snapshot.table.id,
        tokenId: token.id,
        x,
        y,
      }),
      { optimisticTokenId: token.id },
    );
  };

  const zoomAtCenter = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    setCamera((current) => {
      const nextScale = clamp(current.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const worldX = (bounds.width / 2 - current.x) / current.scale;
      const worldY = (bounds.height / 2 - current.y) / current.scale;
      return {
        scale: nextScale,
        x: bounds.width / 2 - worldX * nextScale,
        y: bounds.height / 2 - worldY * nextScale,
      };
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left;
    const cursorY = event.clientY - bounds.top;
    setCamera((current) => {
      const nextScale = clamp(
        current.scale * Math.exp(-event.deltaY * 0.0012),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const worldX = (cursorX - current.x) / current.scale;
      const worldY = (cursorY - current.y) / current.scale;
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      };
    });
  };

  const handleMapPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const pan = mapPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mapPanRef.current = null;
  };

  const selectedToken = selectedTokenId
    ? snapshot.tokens.find((token) => token.id === selectedTokenId) ?? null
    : null;
  const selectedCharacter = selectedCharacterId
    ? snapshot.characters.find((character) => character.id === selectedCharacterId) ?? null
    : null;
  const canEditSelectedCharacter = Boolean(
    selectedCharacter &&
      (canManage || selectedCharacter.userId === viewer.id),
  );
  const mapGroups = snapshot.maps.reduce<
    Array<{ name: string; maps: TabletopSnapshot["maps"] }>
  >((groups, map) => {
    const existing = groups.find((group) => group.name === map.groupName);
    if (existing) existing.maps.push(map);
    else groups.push({ name: map.groupName, maps: [map] });
    return groups;
  }, []);
  const activeMap = snapshot.maps.find(
    (map) => map.id === snapshot.table.activeMapId,
  );
  const currentChapter = snapshot.chapterProgress.current;
  const nextChapter = snapshot.chapterProgress.next;
  const activeMapIndex = snapshot.maps.findIndex(
    (map) => map.id === snapshot.table.activeMapId,
  );
  const suggestedChapterMap =
    snapshot.maps[activeMapIndex + 1] ??
    snapshot.maps.find((map) => map.id !== snapshot.table.activeMapId) ??
    activeMap ??
    null;

  const syncLabel =
    syncStatus === "synced"
      ? `Sincronizado · r${snapshot.table.revision}`
      : syncStatus === "syncing"
        ? "Sincronizando"
        : "Reconectando";

  return (
    <main
      className="vtt-screen"
      style={campaignThemeStyle(
        snapshot.campaign.primaryColor,
        snapshot.campaign.secondaryColor,
      )}
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {diceAnimation ? (
        <div
          key={diceAnimation.id}
          className="vtt-dice-reveal"
          data-vtt-ui
        >
          <div className="vtt-dice-tumbler" aria-hidden="true">
            <span>{diceAnimation.total}</span>
          </div>
          <p>
            <strong>{diceAnimation.actorName}</strong>
            <span>{diceAnimation.expression}</span>
            <b>→ {diceAnimation.total}</b>
          </p>
        </div>
      ) : null}

      {chapterTransition ? (
        <div
          key={chapterTransition.id}
          className="vtt-chapter-reveal"
          aria-hidden="true"
          data-vtt-ui
        >
          <div className="vtt-chapter-reveal-grid" aria-hidden="true" />
          <div className="vtt-chapter-reveal-copy">
            <p>
              {chapterTransition.completed
                ? "OPERAÇÃO NEPTUNE // OBJETIVOS ENCERRADOS"
                : "OPERAÇÃO NEPTUNE // PROGRESSÃO CONFIRMADA"}
            </p>
            <span>
              {chapterTransition.completed
                ? "OPERAÇÃO CONCLUÍDA"
                : `CAPÍTULO ${chapterTransition.order.toString().padStart(2, "0")}`}
            </span>
            <TacticalScrambleText
              key={chapterTransition.id}
              text={chapterTransition.title}
              as="strong"
              delay={260}
            />
            <small>
              {chapterTransition.completed
                ? "Registro final transmitido à equipe"
                : `Novo teatro: ${chapterTransition.mapName}`}
            </small>
          </div>
          <i className="vtt-chapter-reveal-scan" aria-hidden="true" />
        </div>
      ) : null}

      <header className="vtt-topbar" data-vtt-ui>
        <div className="vtt-topbar-operation">
          <Link
            href={`/campaigns/${encodeURIComponent(snapshot.campaign.slug)}`}
            aria-label="Voltar à campanha"
          >
            ←
          </Link>
          <div>
            <p>{snapshot.campaign.name}</p>
            <h1>
              Sessão {snapshot.session.sessionNumber.toString().padStart(2, "0")} ·{" "}
              {snapshot.session.title}
            </h1>
            {snapshot.chapterProgress.current ? (
              <span className="vtt-topbar-chapter">
                Capítulo {snapshot.chapterProgress.current.order.toString().padStart(2, "0")} ·{" "}
                {snapshot.chapterProgress.current.title}
              </span>
            ) : null}
          </div>
        </div>

        <div className="vtt-topbar-state">
          <span className={`vtt-sync-state ${syncStatus}`}>
            <i aria-hidden="true" /> {syncLabel}
          </span>
          <span className="vtt-viewer-role">
            {canManage ? "Mestre" : "Jogador"} · @{viewer.username}
          </span>
          <button
            type="button"
            className="vtt-panel-toggle"
            aria-expanded={sidePanelOpen}
            aria-controls="vtt-side-panel"
            onClick={() => setSidePanelOpen((current) => !current)}
          >
            {sidePanelOpen ? "Fechar painel" : "Abrir painel"}
          </button>
          {canManage ? (
            <button
              type="button"
              className="vtt-end-session"
              disabled={pendingAction === "close"}
              onClick={() => {
                if (
                  window.confirm(
                    "Encerrar a sessão e enviar este registro para o histórico?",
                  )
                ) {
                  void executeCommand(
                    "close",
                    closeVirtualTableAction({
                      campaignSlug: snapshot.campaign.slug,
                      tableId: snapshot.table.id,
                    }),
                  );
                }
              }}
            >
              Encerrar
            </button>
          ) : null}
        </div>
      </header>

      <div className={`vtt-workspace ${sidePanelOpen ? "panel-open" : ""}`}>
        <section className="vtt-map-shell" aria-labelledby="vtt-map-title">
          <h2 id="vtt-map-title" className="sr-only">
            Mapa compartilhado: {snapshot.table.mapName}
          </h2>

          <aside
            className={`vtt-map-library ${mapLibraryOpen ? "open" : "collapsed"}`}
            aria-label="Biblioteca de mapas da campanha"
            data-vtt-ui
          >
            <header>
              <div>
                <p>Arquivo cartográfico</p>
                <strong>{snapshot.maps.length.toString().padStart(2, "0")} mapas</strong>
              </div>
              <button
                type="button"
                aria-expanded={mapLibraryOpen}
                aria-label={mapLibraryOpen ? "Recolher biblioteca" : "Abrir biblioteca"}
                onClick={() => setMapLibraryOpen((current) => !current)}
              >
                {mapLibraryOpen ? "‹" : "›"}
              </button>
            </header>
            {mapLibraryOpen ? (
              <div className="vtt-map-library-body">
                {canManage && snapshot.chapterProgress.current ? (
                  <section className="vtt-chapter-control">
                    <p>Progressão narrativa</p>
                    <strong>
                      {snapshot.chapterProgress.current.order.toString().padStart(2, "0")} ·{" "}
                      {snapshot.chapterProgress.current.title}
                    </strong>
                    <span>
                      {snapshot.chapterProgress.completedCount}/{snapshot.chapterProgress.total} concluídos
                    </span>
                    <button
                      type="button"
                      disabled={pendingAction === "advance-chapter"}
                      onClick={() => setModal("chapter")}
                    >
                      {snapshot.chapterProgress.next
                        ? "Avançar capítulo"
                        : "Concluir capítulo"}{" "}
                      <b>→</b>
                    </button>
                    {!snapshot.chapterProgress.next ? (
                      <small>Este é o último capítulo publicado da operação.</small>
                    ) : null}
                  </section>
                ) : null}
                {mapGroups.map((group) => (
                  <section key={group.name}>
                    <div className="vtt-map-group-heading">
                      <span>{group.name}</span>
                      <i>{group.maps.length}</i>
                    </div>
                    <ul>
                      {group.maps.map((map) => {
                        const isActive = map.id === snapshot.table.activeMapId;
                        return (
                          <li key={map.id} className={isActive ? "active" : ""}>
                            <button
                              type="button"
                              className="vtt-map-card"
                              disabled={!canManage || isActive || pendingAction === `map:${map.id}`}
                              aria-current={isActive ? "true" : undefined}
                              onClick={() =>
                                void executeCommand(
                                  `map:${map.id}`,
                                  activateVirtualTableMapAction({
                                    campaignSlug: snapshot.campaign.slug,
                                    tableId: snapshot.table.id,
                                    mapId: map.id,
                                  }),
                                )
                              }
                            >
                              <span className="vtt-map-thumb">
                                {map.imageUrl ? (
                                  <Image
                                    src={map.imageUrl}
                                    alt=""
                                    fill
                                    unoptimized={map.imageUrl.startsWith("/media/")}
                                    sizes="220px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <i aria-hidden="true">MAP</i>
                                )}
                              </span>
                              <span className="vtt-map-card-copy">
                                <strong>{map.layerName || map.name}</strong>
                                <small>{mapScaleLabel(map.scale)}</small>
                              </span>
                              {isActive ? <em>AO VIVO</em> : null}
                            </button>
                            {canManage && !map.builtIn ? (
                              <button
                                type="button"
                                className="vtt-map-delete"
                                aria-label={`Excluir ${map.name} da biblioteca`}
                                disabled={isActive || pendingAction === `delete-map:${map.id}`}
                                onClick={() => {
                                  if (window.confirm(`Excluir ${map.name} da biblioteca?`)) {
                                    void executeCommand(
                                      `delete-map:${map.id}`,
                                      deleteVirtualTableMapAction({
                                        campaignSlug: snapshot.campaign.slug,
                                        tableId: snapshot.table.id,
                                        mapId: map.id,
                                      }),
                                    );
                                  }
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                {canManage ? (
                  <button
                    type="button"
                    className="vtt-map-add"
                    onClick={() => setModal("map")}
                  >
                    <b>+</b> Armazenar mapa
                  </button>
                ) : (
                  <p className="vtt-map-library-note">A troca de cenário é controlada pelo mestre.</p>
                )}
              </div>
            ) : null}
          </aside>

          <div
            ref={viewportRef}
            className="vtt-map-viewport"
            onWheel={handleWheel}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              mapPanRef.current = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startCameraX: cameraRef.current.x,
                startCameraY: cameraRef.current.y,
              };
            }}
            onPointerMove={(event) => {
              const pan = mapPanRef.current;
              if (!pan || pan.pointerId !== event.pointerId) return;
              setCamera((current) => ({
                ...current,
                x: pan.startCameraX + event.clientX - pan.startClientX,
                y: pan.startCameraY + event.clientY - pan.startClientY,
              }));
            }}
            onPointerUp={handleMapPointerEnd}
            onPointerCancel={handleMapPointerEnd}
          >
            <div
              className="vtt-map-world"
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
              }}
            >
              {snapshot.table.mapImageUrl ? (
                <Image
                  src={snapshot.table.mapImageUrl}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="100vw"
                  className="vtt-map-image object-contain"
                />
              ) : (
                <div className="vtt-map-empty">
                  <span>MAP // NULL</span>
                  <p>O mestre ainda não escolheu um mapa.</p>
                </div>
              )}
              <div className="vtt-map-grid" aria-hidden="true" />

              {snapshot.tokens.map((token) => {
                const controllable = canControlToken(token);
                const selected = selectedTokenId === token.id;
                const visionHeight = clamp(token.visionRange, 0.04, 0.65) * WORLD_WIDTH;
                const halfAngle = (clamp(token.visionAngle, 20, 150) / 2) * (Math.PI / 180);
                const visionWidth = Math.min(
                  WORLD_WIDTH * 1.25,
                  visionHeight * Math.tan(halfAngle) * 2,
                );
                const style: TokenPositionStyle = {
                  left: `${token.x * 100}%`,
                  top: `${token.y * 100}%`,
                  zIndex: token.zIndex + 5,
                  "--token-size": `${token.size * WORLD_WIDTH}px`,
                  "--token-accent": token.accentColor,
                  "--vision-height": `${visionHeight}px`,
                  "--vision-width": `${visionWidth}px`,
                  "--vision-rotation": `${token.rotation}deg`,
                  "--vision-color": token.visionColor,
                };
                return (
                  <button
                    key={token.id}
                    type="button"
                    data-table-token
                    className={`vtt-token ${token.kind} disposition-${token.disposition} ${token.size <= 0.02 ? "micro-token" : ""} ${controllable ? "controllable" : "locked"} ${selected ? "selected" : ""} ${draggingTokenId === token.id ? "dragging" : ""} ${token.visible ? "" : "hidden-token"}`}
                    style={style}
                    aria-label={`${token.name}, ${tokenKindLabel(token.kind)}, ${dispositionLabel(token.disposition)}${token.collectible ? ", item coletável" : ""}${controllable ? ", você pode mover este token" : ", somente o mestre pode mover"}${token.visible ? "" : ", oculto dos jogadores"}`}
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedTokenId(token.id);
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (
                        event.button !== 0 ||
                        !controllable ||
                        pendingMoveIdsRef.current.has(token.id)
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      tokenDragRef.current = {
                        pointerId: event.pointerId,
                        tokenId: token.id,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startX: token.x,
                        startY: token.y,
                        lastX: token.x,
                        lastY: token.y,
                      };
                      setDraggingTokenId(token.id);
                      setSelectedTokenId(token.id);
                    }}
                    onPointerMove={(event) => {
                      const drag = tokenDragRef.current;
                      if (!drag || drag.pointerId !== event.pointerId) return;
                      const scale = cameraRef.current.scale;
                      const x = clamp(
                        drag.startX +
                          (event.clientX - drag.startClientX) /
                            (WORLD_WIDTH * scale),
                        0.015,
                        0.985,
                      );
                      const y = clamp(
                        drag.startY +
                          (event.clientY - drag.startClientY) /
                            (WORLD_HEIGHT * scale),
                        0.015,
                        0.985,
                      );
                      drag.lastX = x;
                      drag.lastY = y;
                      updateLocalToken(token.id, x, y);
                    }}
                    onPointerUp={finishTokenDrag}
                    onPointerCancel={finishTokenDrag}
                    onKeyDown={(event) => moveTokenWithKeyboard(event, token)}
                  >
                    {token.visionEnabled ? (
                      <span className="vtt-vision-cone" aria-hidden="true" />
                    ) : null}
                    <span className="vtt-token-disc">
                      {token.imageUrl ? (
                        <Image
                          src={token.imageUrl}
                          alt=""
                          fill
                          unoptimized={token.imageUrl.startsWith("/media/")}
                          sizes="128px"
                          className="object-cover"
                        />
                      ) : (
                        <b>{tokenFallback(token.kind)}</b>
                      )}
                    </span>
                    <span className="vtt-token-name">{token.name}</span>
                    {!token.visible ? (
                      <i className="vtt-token-hidden-mark" aria-hidden="true">
                        H
                      </i>
                    ) : null}
                    {token.collectible ? (
                      <i className="vtt-token-collectible-mark" aria-hidden="true">
                        +
                      </i>
                    ) : null}
                  </button>
                );
              })}

              {!snapshot.tokens.length ? (
                <div className="vtt-no-tokens">
                  <span>Área limpa</span>
                  <p>{canManage ? "Adicione o primeiro token." : "O mestre ainda não posicionou peças."}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="vtt-map-readout" data-vtt-ui>
            <span>
              {activeMap ? `${activeMap.groupName} / ${activeMap.layerName}` : snapshot.table.mapName}
            </span>
            <i>ZOOM {Math.round(camera.scale * 100)}%</i>
          </div>

          <div className="vtt-map-toolbar" data-vtt-ui>
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setModal("token");
                  }}
                >
                  <b>+</b> Token
                </button>
                <button type="button" onClick={() => setMapLibraryOpen(true)}>
                  Biblioteca
                </button>
                <span aria-hidden="true" />
              </>
            ) : null}
            <button type="button" onClick={() => zoomAtCenter(0.82)} aria-label="Diminuir zoom">
              −
            </button>
            <button type="button" onClick={fitMap}>
              Ajustar
            </button>
            <button type="button" onClick={() => zoomAtCenter(1.22)} aria-label="Aumentar zoom">
              +
            </button>
          </div>

          {notice ? (
            <button
              type="button"
              className={`vtt-notice ${notice.ok ? "success" : "error"}`}
              onClick={() => setNotice(null)}
              data-vtt-ui
            >
              {notice.message}
            </button>
          ) : null}
        </section>

        <aside
          id="vtt-side-panel"
          className="vtt-side-panel"
          aria-label="Controles e histórico da mesa"
        >
          <section className="vtt-panel-section vtt-members-section">
            <header>
              <p>Equipe autorizada</p>
              <span>{snapshot.players.length.toString().padStart(2, "0")}</span>
            </header>
            <ul>
              {snapshot.players.map((player) => (
                <li key={player.userId}>
                  <span className="vtt-member-avatar" aria-hidden="true">
                    {player.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
                  </span>
                  <div>
                    <strong>{player.name}</strong>
                    <small>
                      {player.role === "game_master" ? "Mestre" : "Jogador"}
                      {player.userId === viewer.id ? " · você" : ""}
                    </small>
                    {player.characters.length ? (
                      <span className="vtt-member-characters">
                        {player.characters.map((character) => (
                          <button
                            key={character.id}
                            type="button"
                            onClick={() => {
                              setSelectedCharacterId(character.id);
                              setModal("character");
                            }}
                          >
                            {character.name} <i aria-hidden="true">↗</i>
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <p className="vtt-presence-note">Lista de membros da campanha · presença não simulada</p>
          </section>

          {canManage && selectedToken ? (
            <section className="vtt-panel-section vtt-selected-token">
              <header>
                <p>Peça selecionada</p>
                <button
                  type="button"
                  onClick={() => setSelectedTokenId(null)}
                  aria-label="Limpar seleção"
                >
                  ×
                </button>
              </header>
              <strong>{selectedToken.name}</strong>
              <span>
                <i
                  className="vtt-token-color-dot"
                  style={{ backgroundColor: selectedToken.accentColor }}
                  aria-hidden="true"
                />
                {dispositionLabel(selectedToken.disposition)} · {tokenKindLabel(selectedToken.kind)} ·{" "}
                {selectedToken.visible ? "visível" : "oculto"}
              </span>
              {selectedToken.notes ? <p>{selectedToken.notes}</p> : null}
              <div>
                <button
                  type="button"
                  onClick={() => setModal("token-edit")}
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={pendingAction === `toggle:${selectedToken.id}`}
                  onClick={() =>
                    void executeCommand(
                      `toggle:${selectedToken.id}`,
                      toggleVirtualTableTokenAction({
                        campaignSlug: snapshot.campaign.slug,
                        tableId: snapshot.table.id,
                        tokenId: selectedToken.id,
                        visible: !selectedToken.visible,
                      }),
                    )
                  }
                >
                  {selectedToken.visible ? "Ocultar" : "Revelar"}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={pendingAction === `delete:${selectedToken.id}`}
                  onClick={() => {
                    if (window.confirm(`Remover ${selectedToken.name} da mesa?`)) {
                      void executeCommand(
                        `delete:${selectedToken.id}`,
                        deleteVirtualTableTokenAction({
                          campaignSlug: snapshot.campaign.slug,
                          tableId: snapshot.table.id,
                          tokenId: selectedToken.id,
                        }),
                      );
                      setSelectedTokenId(null);
                    }
                  }}
                >
                  Remover
                </button>
              </div>
            </section>
          ) : null}

          <section className="vtt-panel-section vtt-dice-section">
            <header>
              <p>Dados</p>
              <span>Servidor</span>
            </header>
            <div className="vtt-dice-grid">
              {DICE_SHORTCUTS.map((sides) => (
                <button
                  key={sides}
                  type="button"
                  className={pendingAction === "roll" ? "rolling" : ""}
                  disabled={pendingAction === "roll"}
                  onClick={() =>
                    void executeCommand(
                      "roll",
                      rollVirtualTableDiceAction({
                        campaignSlug: snapshot.campaign.slug,
                        tableId: snapshot.table.id,
                        expression: `1d${sides}`,
                      }),
                    )
                  }
                >
                  <span>D{sides}</span>
                  <i aria-hidden="true">{sides}</i>
                </button>
              ))}
            </div>
            <form
              className="vtt-dice-command"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const expression = String(formData.get("expression") ?? "");
                void executeCommand(
                  "roll",
                  rollVirtualTableDiceAction({
                    campaignSlug: snapshot.campaign.slug,
                    tableId: snapshot.table.id,
                    expression,
                  }),
                );
              }}
            >
              <label htmlFor="dice-expression">Comando</label>
              <div>
                <input
                  id="dice-expression"
                  name="expression"
                  defaultValue="1d20"
                  placeholder="2d6+3"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" disabled={pendingAction === "roll"}>
                  Rolar
                </button>
              </div>
            </form>
          </section>

          <section className="vtt-panel-section vtt-roll-history">
            <header>
              <p>Rolagens da sessão</p>
              <span>{snapshot.rolls.length.toString().padStart(2, "0")}</span>
            </header>
            {snapshot.rolls.length ? (
              <ol>
                {snapshot.rolls.slice(0, 20).map((roll) => (
                  <li key={roll.id}>
                    <div>
                      <strong>{roll.actorName}</strong>
                      <time>{rollTimeFormatter.format(new Date(roll.createdAt))}</time>
                    </div>
                    <p>
                      <span>{roll.expression}</span>
                      <b>→ {roll.total}</b>
                    </p>
                    {roll.diceValues.length > 1 || roll.modifier !== 0 ? (
                      <small>
                        [{roll.diceValues.join(" + ")}]
                        {roll.modifier > 0
                          ? ` + ${roll.modifier}`
                          : roll.modifier < 0
                            ? ` − ${Math.abs(roll.modifier)}`
                            : ""}
                      </small>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="vtt-empty-rolls">Nenhum dado rolado nesta sessão.</p>
            )}
          </section>
        </aside>
      </div>

      {modal === "chapter" && currentChapter ? (
        <TableModal
          eyebrow="Comando do mestre"
          title={nextChapter ? "Avançar a operação" : "Concluir a operação"}
          description={
            nextChapter
              ? "A conclusão desbloqueia o próximo capítulo para todos e transmite o mapa escolhido na mesma atualização."
              : "A conclusão encerra o último capítulo publicado e registra a operação como finalizada."
          }
          onClose={() => setModal(null)}
        >
          <form
            className="vtt-control-form vtt-chapter-advance-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void executeCommand(
                "advance-chapter",
                advanceVirtualTableChapterAction({
                  campaignSlug: snapshot.campaign.slug,
                  tableId: snapshot.table.id,
                  currentChapterId: currentChapter.id,
                  nextChapterId: nextChapter?.id ?? null,
                  mapId: nextChapter
                    ? String(formData.get("mapId") ?? "")
                    : null,
                }),
                { closeModal: true },
              );
            }}
          >
            <div className="vtt-chapter-route" aria-label="Mudança de capítulo">
              <div>
                <span>Concluir</span>
                <strong>
                  {currentChapter.order.toString().padStart(2, "0")} · {currentChapter.title}
                </strong>
              </div>
              <i aria-hidden="true">→</i>
              <div>
                <span>{nextChapter ? "Iniciar" : "Resultado"}</span>
                <strong>
                  {nextChapter
                    ? `${nextChapter.order.toString().padStart(2, "0")} · ${nextChapter.title}`
                    : "Operação concluída"}
                </strong>
              </div>
            </div>
            {nextChapter ? (
              <label>
                <span>Mapa inicial do próximo capítulo</span>
                <select
                  name="mapId"
                  defaultValue={suggestedChapterMap?.id ?? ""}
                  required
                >
                  <option value="" disabled>Selecione um mapa</option>
                  {snapshot.maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.groupName} · {map.layerName}
                    </option>
                  ))}
                </select>
                <small>
                  A sugestão automática é o próximo mapa da biblioteca — saindo do Heliporto, a Zona de Inserção.
                </small>
              </label>
            ) : null}
            <div className="vtt-form-actions">
              <button
                type="submit"
                disabled={
                  pendingAction === "advance-chapter" ||
                  (Boolean(nextChapter) && !suggestedChapterMap)
                }
              >
                {pendingAction === "advance-chapter"
                  ? "Transmitindo..."
                  : nextChapter
                    ? `Concluir e iniciar ${nextChapter.title}`
                    : "Concluir operação"}
              </button>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </TableModal>
      ) : null}

      {modal === "token" ? (
        <TableModal
          title="Adicionar token"
          description="Personagens ficam vinculados ao jogador dono da ficha. NPCs, inimigos e objetos permanecem sob controle do mestre."
          onClose={() => setModal(null)}
        >
          <form
            className="vtt-control-form"
            encType="multipart/form-data"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              formData.set("campaignSlug", snapshot.campaign.slug);
              formData.set("tableId", snapshot.table.id);
              void executeCommand(
                "create-token",
                createVirtualTableTokenAction(formData),
                { closeModal: true },
              );
            }}
          >
            <div className="vtt-form-grid">
              <label>
                <span>Tipo</span>
                <select name="kind" defaultValue="npc">
                  <option value="character">Personagem</option>
                  <option value="npc">NPC</option>
                  <option value="enemy">Inimigo</option>
                  <option value="object">Objeto</option>
                </select>
              </label>
              <label>
                <span>Relação tática</span>
                <select name="disposition" defaultValue="ally">
                  <option value="player">Operador</option>
                  <option value="ally">NPC aliado</option>
                  <option value="neutral">NPC neutro</option>
                  <option value="hostile">NPC inimigo</option>
                  <option value="object">Objeto / item</option>
                </select>
              </label>
              <label>
                <span>Nome</span>
                <input name="name" maxLength={80} placeholder="Ex.: Sentinela" />
              </label>
              <label>
                <span>Quantidade de cópias</span>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  defaultValue="1"
                />
                <small>
                  Use 5 para criar cinco tokens iguais, numerados de 01 a 05.
                </small>
              </label>
              <label className="full-span">
                <span>Personagem associado</span>
                <select name="characterId" defaultValue="">
                  <option value="">Nenhum — controle exclusivo do mestre</option>
                  {snapshot.characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
                <small>Ao associar uma ficha, somente seu dono e o mestre poderão mover o token.</small>
              </label>
              <label>
                <span>Tamanho</span>
                <select name="size" defaultValue="0.055">
                  <option value="0.0125">Superpequeno · mapas enormes</option>
                  <option value="0.025">Miniatura · ambientes amplos</option>
                  <option value="0.04">Pequeno</option>
                  <option value="0.055">Médio</option>
                  <option value="0.075">Grande</option>
                  <option value="0.1">Enorme</option>
                </select>
                <small>Superpequeno ocupa cerca de 20 px no zoom normal do navio.</small>
              </label>
              <label>
                <span>Cor de identificação</span>
                <input name="accentColor" type="color" defaultValue="#75a9c8" />
              </label>
              <label>
                <span>Imagem opcional</span>
                <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
              </label>
              <label className="full-span">
                <span>Notas rápidas</span>
                <textarea
                  name="notes"
                  maxLength={400}
                  rows={3}
                  placeholder="Função na cena, pista carregada ou efeito do objeto."
                />
              </label>
              <label>
                <span>Direção do olhar</span>
                <input name="rotation" type="number" min="0" max="359" defaultValue="0" />
              </label>
              <label>
                <span>Abertura do campo de visão</span>
                <select name="visionAngle" defaultValue="70">
                  <option value="35">35° · foco estreito</option>
                  <option value="70">70° · padrão</option>
                  <option value="110">110° · amplo</option>
                  <option value="145">145° · periférico</option>
                </select>
              </label>
              <label>
                <span>Alcance da visão</span>
                <select name="visionRange" defaultValue="0.18">
                  <option value="0.1">Curto</option>
                  <option value="0.18">Médio</option>
                  <option value="0.3">Longo</option>
                  <option value="0.45">Muito longo</option>
                </select>
              </label>
              <label>
                <span>Cor do campo de visão</span>
                <input name="visionColor" type="color" defaultValue="#f0a44b" />
              </label>
              <label className="vtt-checkbox full-span">
                <input name="visionEnabled" type="checkbox" defaultChecked />
                <span>Exibir cone de campo de visão</span>
              </label>
              <label className="vtt-checkbox full-span">
                <input name="collectible" type="checkbox" />
                <span>Marcar como objeto coletável</span>
              </label>
              <label className="vtt-checkbox full-span">
                <input name="visible" type="checkbox" defaultChecked />
                <span>Mostrar imediatamente para os jogadores</span>
              </label>
            </div>
            {notice && !notice.ok ? (
              <p className="vtt-form-error" role="alert">
                {notice.message}
              </p>
            ) : null}
            <div className="vtt-form-actions">
              <button type="submit" disabled={pendingAction === "create-token"}>
                {pendingAction === "create-token"
                  ? "Criando tokens..."
                  : "Adicionar à mesa"}
              </button>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </TableModal>
      ) : null}

      {modal === "token-edit" && selectedToken ? (
        <TableModal
          title={`Personalizar ${selectedToken.name}`}
          description="Ajuste identidade, função tática e campo de visão. As mudanças serão transmitidas para toda a sessão."
          onClose={() => setModal(null)}
        >
          <form
            className="vtt-control-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void executeCommand(
                `edit:${selectedToken.id}`,
                updateVirtualTableTokenAction({
                  campaignSlug: snapshot.campaign.slug,
                  tableId: snapshot.table.id,
                  tokenId: selectedToken.id,
                  mapId: String(formData.get("mapId") ?? "") || undefined,
                  name: String(formData.get("name") ?? ""),
                  kind: String(formData.get("kind") ?? "npc") as TabletopTokenView["kind"],
                  disposition: String(
                    formData.get("disposition") ?? "neutral",
                  ) as TabletopTokenView["disposition"],
                  size: Number(formData.get("size")),
                  visible: selectedToken.visible,
                  accentColor: String(formData.get("accentColor") ?? "#75a9c8"),
                  notes: String(formData.get("notes") ?? ""),
                  collectible: formData.get("collectible") === "on",
                  rotation: Number(formData.get("rotation")),
                  visionEnabled: formData.get("visionEnabled") === "on",
                  visionAngle: Number(formData.get("visionAngle")),
                  visionRange: Number(formData.get("visionRange")),
                  visionColor: String(formData.get("visionColor") ?? "#f0a44b"),
                }),
                { closeModal: true },
              );
            }}
          >
            <div className="vtt-form-grid">
              <label>
                <span>Nome</span>
                <input name="name" required maxLength={80} defaultValue={selectedToken.name} />
              </label>
              <label>
                <span>Tipo</span>
                <select name="kind" defaultValue={selectedToken.kind}>
                  <option value="character">Personagem</option>
                  <option value="npc">NPC</option>
                  <option value="enemy">Inimigo</option>
                  <option value="object">Objeto</option>
                </select>
              </label>
              <label>
                <span>Relação tática</span>
                <select name="disposition" defaultValue={selectedToken.disposition}>
                  <option value="player">Operador</option>
                  <option value="ally">NPC aliado</option>
                  <option value="neutral">NPC neutro</option>
                  <option value="hostile">NPC inimigo</option>
                  <option value="object">Objeto / item</option>
                </select>
              </label>
              <label>
                <span>Mapa / camada</span>
                <select name="mapId" defaultValue={selectedToken.mapId ?? ""}>
                  {snapshot.maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.groupName} · {map.layerName}
                    </option>
                  ))}
                </select>
                <small>Mover para outra camada retira o token do mapa atual.</small>
              </label>
              <label>
                <span>Cor de identificação</span>
                <input name="accentColor" type="color" defaultValue={selectedToken.accentColor} />
              </label>
              <label>
                <span>Tamanho</span>
                <select name="size" defaultValue={String(selectedToken.size)}>
                  <option value="0.0125">Superpequeno · mapas enormes</option>
                  <option value="0.025">Miniatura · ambientes amplos</option>
                  <option value="0.04">Pequeno</option>
                  <option value="0.055">Médio</option>
                  <option value="0.075">Grande</option>
                  <option value="0.1">Enorme</option>
                </select>
                <small>Ideal para operadores em navios, bases e mapas de grande escala.</small>
              </label>
              <label>
                <span>Direção do olhar</span>
                <input
                  name="rotation"
                  type="number"
                  min="0"
                  max="359"
                  defaultValue={selectedToken.rotation}
                />
              </label>
              <label>
                <span>Abertura da visão</span>
                <input
                  name="visionAngle"
                  type="number"
                  min="20"
                  max="150"
                  defaultValue={selectedToken.visionAngle}
                />
              </label>
              <label>
                <span>Alcance da visão</span>
                <select name="visionRange" defaultValue={String(selectedToken.visionRange)}>
                  <option value="0.1">Curto</option>
                  <option value="0.18">Médio</option>
                  <option value="0.3">Longo</option>
                  <option value="0.45">Muito longo</option>
                </select>
              </label>
              <label>
                <span>Cor do cone</span>
                <input name="visionColor" type="color" defaultValue={selectedToken.visionColor} />
              </label>
              <label className="full-span">
                <span>Notas rápidas</span>
                <textarea name="notes" rows={3} maxLength={400} defaultValue={selectedToken.notes} />
              </label>
              <label className="vtt-checkbox full-span">
                <input name="visionEnabled" type="checkbox" defaultChecked={selectedToken.visionEnabled} />
                <span>Exibir cone de campo de visão</span>
              </label>
              <label className="vtt-checkbox full-span">
                <input name="collectible" type="checkbox" defaultChecked={selectedToken.collectible} />
                <span>Marcar como objeto coletável</span>
              </label>
            </div>
            <div className="vtt-form-actions">
              <button type="submit" disabled={pendingAction === `edit:${selectedToken.id}`}>
                {pendingAction === `edit:${selectedToken.id}` ? "Salvando..." : "Salvar personalização"}
              </button>
              <button type="button" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </form>
        </TableModal>
      ) : null}

      {modal === "map" ? (
        <TableModal
          title="Armazenar novo mapa"
          description="O arquivo entra na biblioteca desta campanha e já fica ativo para todos. Formato horizontal 3:2 recomendado."
          onClose={() => setModal(null)}
        >
          <form
            className="vtt-control-form"
            encType="multipart/form-data"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              formData.set("campaignSlug", snapshot.campaign.slug);
              formData.set("tableId", snapshot.table.id);
              void executeCommand(
                "update-map",
                updateVirtualTableMapAction(formData),
                { closeModal: true },
              );
            }}
          >
            <div className="vtt-form-grid">
              <label>
                <span>Nome do mapa</span>
                <input name="name" maxLength={90} placeholder="Ex.: Armazém de Kandahar" />
              </label>
              <label>
                <span>Conjunto / local</span>
                <input name="groupName" maxLength={70} placeholder="Ex.: Complexo inimigo" />
              </label>
              <label>
                <span>Camada / andar</span>
                <input name="layerName" maxLength={70} placeholder="Ex.: Térreo" />
              </label>
              <label>
                <span>Escala</span>
                <select name="scale" defaultValue="large">
                  <option value="medium">Médio</option>
                  <option value="large">Grande</option>
                  <option value="huge">Muito grande</option>
                </select>
              </label>
              <label className="vtt-map-upload full-span">
                <span>Imagem do novo mapa</span>
                <input
                  name="map"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/avif"
                />
                <small>JPEG, PNG, WebP ou AVIF · máximo de 6 MB.</small>
              </label>
            </div>
            <div className="vtt-form-actions">
              <button type="submit" disabled={pendingAction === "update-map"}>
                {pendingAction === "update-map" ? "Armazenando..." : "Salvar e ativar"}
              </button>
              <button
                type="button"
                disabled={pendingAction === "reset-map"}
                onClick={() =>
                  void executeCommand(
                    "reset-map",
                    resetVirtualTableMapAction({
                      campaignSlug: snapshot.campaign.slug,
                      tableId: snapshot.table.id,
                    }),
                    { closeModal: true },
                  )
                }
              >
                Restaurar padrão
              </button>
            </div>
          </form>
        </TableModal>
      ) : null}

      {modal === "character" && selectedCharacter ? (
        <TableModal
          eyebrow="Ficha de campo"
          title={selectedCharacter.name}
          description={
            canEditSelectedCharacter
              ? "Organize equipamento, ferimentos e mochila. Cada linha representa um item ou registro."
              : "Consulta do equipamento e das condições atuais deste operador."
          }
          onClose={() => setModal(null)}
        >
          <div className="vtt-loadout-summary">
            <div>
              <span>Ferimentos</span>
              <strong>{selectedCharacter.wounds.length.toString().padStart(2, "0")}</strong>
            </div>
            <div>
              <span>Equipamentos</span>
              <strong>{selectedCharacter.equipment.length.toString().padStart(2, "0")}</strong>
            </div>
            <div>
              <span>Mochila</span>
              <strong>
                {selectedCharacter.backpackItems.length}/{selectedCharacter.inventorySlots}
              </strong>
            </div>
          </div>

          {canEditSelectedCharacter ? (
            <form
              className="vtt-control-form vtt-loadout-form"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void executeCommand(
                  `loadout:${selectedCharacter.id}`,
                  updateCharacterLoadoutAction({
                    campaignSlug: snapshot.campaign.slug,
                    tableId: snapshot.table.id,
                    characterId: selectedCharacter.id,
                    equipment: lines(formData.get("equipment")),
                    wounds: lines(formData.get("wounds")),
                    backpackItems: lines(formData.get("backpackItems")),
                    inventorySlots: Number(formData.get("inventorySlots")),
                  }),
                  { closeModal: true },
                );
              }}
            >
              <div className="vtt-form-grid">
                <label>
                  <span>Equipamento em uso</span>
                  <textarea
                    name="equipment"
                    rows={6}
                    maxLength={1600}
                    defaultValue={selectedCharacter.equipment.join("\n")}
                    placeholder={"Colete tático\nM4A1\nRádio"}
                  />
                </label>
                <label>
                  <span>Ferimentos e condições</span>
                  <textarea
                    name="wounds"
                    rows={6}
                    maxLength={1600}
                    defaultValue={selectedCharacter.wounds.join("\n")}
                    placeholder={"Escoriação no braço\nFadiga leve"}
                  />
                </label>
                <label className="full-span">
                  <span>Itens na mochila</span>
                  <textarea
                    name="backpackItems"
                    rows={6}
                    maxLength={2400}
                    defaultValue={selectedCharacter.backpackItems.join("\n")}
                    placeholder={"Kit médico\nLanterna\nDocumento recuperado"}
                  />
                </label>
                <label>
                  <span>Quantidade de slots</span>
                  <input
                    name="inventorySlots"
                    type="number"
                    min="1"
                    max="40"
                    defaultValue={selectedCharacter.inventorySlots}
                  />
                </label>
              </div>
              <div className="vtt-inventory-slots" aria-label="Ocupação da mochila">
                {Array.from({ length: selectedCharacter.inventorySlots }, (_, index) => (
                  <span
                    key={index}
                    className={selectedCharacter.backpackItems[index] ? "filled" : ""}
                    title={selectedCharacter.backpackItems[index] ?? `Slot ${index + 1} vazio`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                ))}
              </div>
              <div className="vtt-form-actions">
                <button
                  type="submit"
                  disabled={pendingAction === `loadout:${selectedCharacter.id}`}
                >
                  {pendingAction === `loadout:${selectedCharacter.id}` ? "Salvando..." : "Salvar ficha de campo"}
                </button>
                <button type="button" onClick={() => setModal(null)}>Fechar</button>
              </div>
            </form>
          ) : (
            <div className="vtt-loadout-readonly">
              <LoadoutList title="Equipamento" items={selectedCharacter.equipment} empty="Nenhum equipamento registrado." />
              <LoadoutList title="Ferimentos" items={selectedCharacter.wounds} empty="Nenhum ferimento registrado." />
              <LoadoutList title="Mochila" items={selectedCharacter.backpackItems} empty="A mochila está vazia." />
              <div className="vtt-inventory-slots" aria-label="Ocupação da mochila">
                {Array.from({ length: selectedCharacter.inventorySlots }, (_, index) => (
                  <span
                    key={index}
                    className={selectedCharacter.backpackItems[index] ? "filled" : ""}
                    title={selectedCharacter.backpackItems[index] ?? `Slot ${index + 1} vazio`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </TableModal>
      ) : null}
    </main>
  );
}
