"use client";

import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";

export type TabletopRealtimeStatus =
  | "connected"
  | "connecting"
  | "disconnected";

export interface TokenDragPreview {
  tableId: string;
  tokenId: string;
  x: number;
  y: number;
}

export interface TabletopRealtimeConnection {
  available: boolean;
  sendTokenPreview(tokenId: string, x: number, y: number): Promise<void>;
  disconnect(): void;
}

interface PresencePayload {
  userId?: string;
  name?: string;
  onlineAt?: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function broadcastPayload(value: unknown): Record<string, unknown> | null {
  const message = record(value);
  return record(message?.payload) ?? message;
}

export function connectTabletopRealtime({
  tableId,
  viewer,
  onInvalidated,
  onTokenPreview,
  onPresence,
  onStatus,
}: {
  tableId: string;
  viewer: { id: string; name: string; username: string };
  onInvalidated: (revision: number) => void;
  onTokenPreview: (preview: TokenDragPreview) => void;
  onPresence: (onlineUserIds: Set<string>) => void;
  onStatus: (status: TabletopRealtimeStatus) => void;
}): TabletopRealtimeConnection {
  if (!hasPublicSupabaseConfig()) {
    return {
      available: false,
      async sendTokenPreview() {},
      disconnect() {},
    };
  }

  const client = createClient();
  let disposed = false;
  onStatus("connecting");

  const channel = client
    .channel(`vtt:${tableId}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: false },
        presence: { key: viewer.id },
      },
    })
    .on("broadcast", { event: "table_invalidated" }, (message) => {
      const payload = broadcastPayload(message);
      if (
        payload?.tableId === tableId &&
        typeof payload.revision === "number" &&
        Number.isFinite(payload.revision)
      ) {
        onInvalidated(payload.revision);
      }
    })
    .on("broadcast", { event: "token_drag_preview" }, (message) => {
      const payload = broadcastPayload(message);
      if (
        payload?.tableId === tableId &&
        typeof payload.tokenId === "string" &&
        typeof payload.x === "number" &&
        typeof payload.y === "number" &&
        Number.isFinite(payload.x) &&
        Number.isFinite(payload.y) &&
        payload.x >= 0 &&
        payload.x <= 1 &&
        payload.y >= 0 &&
        payload.y <= 1
      ) {
        onTokenPreview({
          tableId,
          tokenId: payload.tokenId,
          x: payload.x,
          y: payload.y,
        });
      }
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresencePayload>();
      const onlineUserIds = new Set<string>();
      for (const [key, presences] of Object.entries(state)) {
        if (key) onlineUserIds.add(key);
        for (const presence of presences) {
          if (typeof presence.userId === "string") {
            onlineUserIds.add(presence.userId);
          }
        }
      }
      onPresence(onlineUserIds);
    })
    .subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        onStatus("connected");
        void channel.track({
          userId: viewer.id,
          name: viewer.name,
          username: viewer.username,
          onlineAt: new Date().toISOString(),
        });
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        onStatus("disconnected");
      }
    });

  return {
    available: true,
    async sendTokenPreview(tokenId, x, y) {
      if (disposed) return;
      const { error } = await client.rpc("broadcast_virtual_table_token_preview", {
        target_table_id: tableId,
        target_token_id: tokenId,
        target_x: x,
        target_y: y,
      });
      if (error && !disposed) {
        // Drag previews are ephemeral. The final server mutation remains the
        // source of truth, so a transient preview failure needs no UI error.
        onStatus("disconnected");
      }
    },
    disconnect() {
      if (disposed) return;
      disposed = true;
      onPresence(new Set());
      void channel
        .untrack()
        .catch(() => undefined)
        .finally(() => {
          void client.removeChannel(channel);
        });
    },
  };
}
