import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Action, GameState } from "../game/types";
import { createGame } from "../game/engine";
import { setActionRelay, useGame } from "../game/store";
import { ensureSession, supabase } from "./supabase";
import {
  claimSeat,
  createRoom,
  discardLobby,
  fetchRoom,
  fetchSeats,
  leaveRoom,
  pushSnapshot,
  seatedInOrder,
  startRoom,
  type RoomStatus,
  type Seat,
} from "./room";

/**
 * What travels on a room's channel.
 *
 * Actions are relayed rather than states: every client owns the same pure
 * engine and the same seeded randomness, so replaying the sequence lands
 * them all on the same board — and regenerates the events that animate it,
 * which a state snapshot could never do.
 */
type Wire =
  | { k: "action"; action: Action; from: number; by: string }
  | { k: "roster" }
  | { k: "start" }
  | { k: "resync" };

interface RoomState {
  code: string | null;
  clientId: string | null;
  hostId: string | null;
  status: RoomStatus;
  seats: Seat[];
  /** Client ids currently connected, from Realtime presence. */
  present: string[];
  /** Snapshot version this client has applied. */
  version: number;
  error: string | null;
  busy: boolean;

  host: (name: string, pawn: number) => Promise<void>;
  join: (code: string, name: string, pawn: number | null) => Promise<void>;
  setPawn: (pawn: number | null, name: string) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
  clearError: () => void;
}

let channel: RealtimeChannel | null = null;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : "Quelque chose n'a pas marché";

export const useRoom = create<RoomState>()((set, get) => ({
  code: null,
  clientId: null,
  hostId: null,
  status: "lobby",
  seats: [],
  present: [],
  version: 0,
  error: null,
  busy: false,

  clearError: () => set({ error: null }),

  host: async (name, pawn) => {
    set({ busy: true, error: null });
    try {
      const clientId = await ensureSession();
      const code = await createRoom(clientId, name, pawn);
      set({ code, clientId, hostId: clientId, status: "lobby" });
      await connect(code, clientId, set, get);
      await refreshSeats(code, set);
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  join: async (code, name, pawn) => {
    set({ busy: true, error: null });
    try {
      const clientId = await ensureSession();
      const room = await fetchRoom(code);
      if (!room) throw new Error("Aucun salon avec ce code");
      if (room.status !== "lobby" && pawn !== null) {
        throw new Error("La partie a déjà commencé — rejoignez en spectateur");
      }
      await claimSeat(code, clientId, name, pawn);
      set({ code, clientId, hostId: room.hostId, status: room.status, version: room.version });
      await connect(code, clientId, set, get);
      await refreshSeats(code, set);
      channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
      if (room.status !== "lobby" && room.state) adopt(room.state, room.seatOrder, clientId);
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  setPawn: async (pawn, name) => {
    const { code, clientId } = get();
    if (!code || !clientId) return;
    try {
      await claimSeat(code, clientId, name, pawn);
      await refreshSeats(code, set);
      channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
    } catch (e) {
      set({ error: message(e) });
    }
  },

  start: async () => {
    const { code, seats, clientId } = get();
    if (!code || !clientId) return;
    const seated = seatedInOrder(seats);
    if (seated.length < 2) {
      set({ error: "Il faut au moins deux joueurs" });
      return;
    }
    set({ busy: true, error: null });
    try {
      const seed = Math.floor(Math.random() * 2147483647);
      const game = createGame(
        seated.map((s) => ({ name: s.name, pawn: s.pawn ?? 0 })),
        seed,
      );
      const seatOrder = seated.map((s) => s.clientId);
      await startRoom(code, seed, game, seatOrder);
      set({ status: "playing", version: 1 });
      channel?.send({ type: "broadcast", event: "room", payload: { k: "start" } satisfies Wire });
      adopt(game, seatOrder, clientId);
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  leave: async () => {
    const { code, clientId, hostId, status } = get();
    setActionRelay(null);
    if (channel) {
      await supabase().removeChannel(channel);
      channel = null;
    }
    if (code && clientId) {
      await leaveRoom(code, clientId);
      // A lobby the host walks out of has no future; one mid-game does.
      if (clientId === hostId && status === "lobby") await discardLobby(code);
    }
    set({ code: null, clientId: null, hostId: null, status: "lobby", seats: [], present: [], version: 0 });
  },
}));

/* ------------------------------------------------------------------ */

type Setter = (partial: Partial<RoomState>) => void;

async function refreshSeats(code: string, set: Setter): Promise<void> {
  set({ seats: await fetchSeats(code) });
}

/** Seats the local device and hands the board over to the game store. */
function adopt(game: GameState, seatOrder: string[], clientId: string): void {
  const seat = seatOrder.indexOf(clientId);
  useGame.getState().adoptGame(game, seat === -1 ? null : seat);
}

/**
 * Pulls the authoritative snapshot and rebuilds from it. Used when a message
 * arrives out of order, which the determinism of the engine makes unlikely
 * but not impossible — a dropped broadcast is enough.
 */
async function resync(code: string, clientId: string, set: Setter): Promise<void> {
  const room = await fetchRoom(code);
  if (!room?.state) return;
  set({ version: room.version, status: room.status });
  adopt(room.state, room.seatOrder, clientId);
}

async function connect(
  code: string,
  clientId: string,
  set: Setter,
  get: () => RoomState,
): Promise<void> {
  const sb = supabase();
  if (channel) await sb.removeChannel(channel);

  channel = sb.channel(`room:${code}`, {
    // The sender receives its own broadcast, so every device — including the
    // one that played — applies the action from the same place in the same
    // order. Nothing is applied optimistically.
    config: { broadcast: { self: true }, presence: { key: clientId } },
  });

  channel.on("broadcast", { event: "room" }, ({ payload }) => {
    void handle(payload as Wire, code, clientId, set, get);
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel?.presenceState() ?? {};
    set({ present: Object.keys(state) });
  });

  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") await channel?.track({ at: Date.now() });
  });

  // Everything the player does is sent rather than played; it lands back
  // through `handle` a moment later.
  setActionRelay((action) => {
    const from = get().version;
    void channel?.send({
      type: "broadcast",
      event: "room",
      payload: { k: "action", action, from, by: clientId } satisfies Wire,
    });
  });
}

async function handle(
  msg: Wire,
  code: string,
  clientId: string,
  set: Setter,
  get: () => RoomState,
): Promise<void> {
  switch (msg.k) {
    case "roster":
      await refreshSeats(code, set);
      return;

    case "start": {
      const room = await fetchRoom(code);
      if (!room?.state) return;
      set({ status: room.status, version: room.version });
      adopt(room.state, room.seatOrder, clientId);
      return;
    }

    case "resync":
      await resync(code, clientId, set);
      return;

    case "action": {
      const version = get().version;
      if (msg.from !== version) {
        // Someone is a step ahead or behind: trust the snapshot, not us.
        await resync(code, clientId, set);
        return;
      }
      useGame.getState().applyLocally(msg.action);
      set({ version: version + 1 });

      // Only the device that played writes the snapshot, so a turn costs one
      // database write rather than one per player.
      if (msg.by === clientId) {
        const game = useGame.getState().game;
        if (game) {
          const ok = await pushSnapshot(code, game, version);
          if (!ok) await resync(code, clientId, set);
          else if (game.phase === "game-over") set({ status: "over" });
        }
      }
      return;
    }
  }
}
