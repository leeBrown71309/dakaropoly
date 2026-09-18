import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Action, GameState } from "../game/types";
import { createGame } from "../game/engine";
import { pushToast, setActionRelay, useGame } from "../game/store";
import { sfx } from "../audio/sounds";
import { ensureSession, supabase } from "./supabase";
import {
  claimSeat,
  createRoom,
  fetchRoomAndSeats,
  fetchSeats,
  leaveRoom,
  pushSnapshot,
  resumeSeat,
  seatOffers,
  seatedInOrder,
  startRoom,
  touchSeat,
  type RoomStatus,
  type Seat,
  type SeatOffer,
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
  | { k: "resync" }
  | { k: "chat"; msg: ChatMessage };

/**
 * Something somebody said. Carried on the channel that is already open for
 * the game itself — Realtime *is* a WebSocket, so a written chat costs a
 * message type and nothing else: no second service, no second connection.
 *
 * Nothing is written to the database. Talk belongs to the evening, and a
 * room that outlives it should not keep a transcript.
 */
export interface ChatMessage {
  id: string;
  clientId: string;
  name: string;
  text: string;
  at: number;
}

/** Longest a message may be, and how many are kept. */
const CHAT_MAX_CHARS = 240;
const CHAT_KEEP = 80;

/** A code that turned out to open onto a game already under way. */
export interface Pending {
  code: string;
  /** The name typed on the join form, kept for the spectator door. */
  name: string;
  offers: SeatOffer[];
}

/** Somebody standing in the room, tracked by presence rather than by a row. */
export type Watcher = { clientId: string; name: string };

/** What each device puts in the channel's presence payload. */
type WatchPresence = { at: number; name: string | null };

interface RoomState {
  code: string | null;
  clientId: string | null;
  hostId: string | null;
  status: RoomStatus;
  seats: Seat[];
  /** Client ids in kickoff order; an index here is an engine player id. */
  seatOrder: string[];
  /** Client ids currently connected, from Realtime presence. */
  present: string[];
  /**
   * This device's own name, from the join form. Tracked in presence so the
   * others can put a name to a spectator, and persisted for the tab so a
   * reload comes back announcing itself correctly.
   */
  myName: string | null;
  /**
   * The connected clients with no seat at the table. Derived from presence,
   * never stored in the database — a spectator is somebody standing in the
   * room, which is a fact about the channel, not about the game. Persisted
   * for the tab all the same, so the list survives a reload whole.
   */
  watchers: Watcher[];
  /** Snapshot version this client has applied. */
  version: number;
  error: string | null;
  busy: boolean;
  /** Set when joining lands on a game in progress rather than a lobby. */
  pending: Pending | null;
  /** True from a page reload until the room has answered again. */
  reconnecting: boolean;
  /** What has been said in this room, oldest first. */
  messages: ChatMessage[];
  /** Messages that arrived while the chat was shut. */
  unread: number;

  host: (name: string, pawn: number) => Promise<void>;
  join: (code: string, name: string, pawn: number | null) => Promise<void>;
  /** Takes back one of the chairs offered in `pending`. */
  resume: (seat: number) => Promise<void>;
  /** Comes in through the spectator door instead of taking a chair. */
  watch: () => Promise<void>;
  cancelPending: () => void;
  setPawn: (pawn: number | null, name: string) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
  /** Picks the room back up after a reload, or after a failed attempt. */
  restore: () => Promise<void>;
  /** Says something to the room. */
  say: (text: string) => void;
  markRead: () => void;
  clearError: () => void;
}

let channel: RealtimeChannel | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

/** How often this device reports in. The database calls a seat free at 75 s. */
const HEARTBEAT_MS = 20_000;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : "Quelque chose n'a pas marché";

/**
 * Stands in for the relay between a reload and the channel coming back.
 *
 * The board is restored from local storage long before the room can be
 * reached again, and an action applied in that gap would land on this device
 * alone: everyone else would carry on from a board this one no longer
 * shares. Refusing loudly is the only safe answer.
 */
function refuseWhileOffline(): void {
  pushToast("Reconnexion au salon…", "info");
}

export const useRoom = create<RoomState>()(
  persist(
    (set, get) => ({
      code: null,
      clientId: null,
      hostId: null,
      status: "lobby",
      seats: [],
      seatOrder: [],
      present: [],
      myName: null,
      watchers: [],
      version: 0,
      error: null,
      busy: false,
      pending: null,
      reconnecting: false,
      messages: [],
      unread: 0,

      clearError: () => set({ error: null }),
      markRead: () => set({ unread: 0 }),

      /**
       * Sent rather than appended: it comes back through the channel like
       * everything else, so a message appears here at the same moment it
       * appears for everyone — and if it never went out, it never shows.
       */
      say: (text) => {
        const trimmed = text.trim().slice(0, CHAT_MAX_CHARS);
        const { clientId, myName } = get();
        if (!trimmed || !channel || !clientId) return;
        const msg: ChatMessage = {
          id: `${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          clientId,
          name: myName ?? "Un joueur",
          text: trimmed,
          at: Date.now(),
        };
        void channel.send({ type: "broadcast", event: "room", payload: { k: "chat", msg } satisfies Wire });
      },
      cancelPending: () => set({ pending: null }),

      host: async (name, pawn) => {
        set({ busy: true, error: null });
        try {
          const clientId = await ensureSession();
          const code = await createRoom(clientId, name, pawn);
          set({ code, clientId, hostId: clientId, status: "lobby", myName: name });
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
          const found = await fetchRoomAndSeats(code);
          if (!found) throw new Error("Aucun salon avec ce code");
          const { room, seats } = found;
          set({ clientId, myName: name });

          // A game already under way is not refused any more: the table is
          // shown as it stands, with whichever chairs are free to take.
          if (room.status !== "lobby") {
            set({ pending: { code, name, offers: seatOffers(room, seats, clientId) } });
            return;
          }

          await claimSeat(code, clientId, name, pawn);
          set({ code, hostId: room.hostId, status: room.status, version: room.version });
          await connect(code, clientId, set, get);
          await refreshSeats(code, set);
          channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
        } catch (e) {
          set({ error: message(e) });
        } finally {
          set({ busy: false });
        }
      },

      resume: async (seat) => {
        const pending = get().pending;
        if (!pending) return;
        set({ busy: true, error: null });
        try {
          const clientId = await ensureSession();
          await resumeSeat(pending.code, seat);
          set({ clientId, pending: null });
          await enterPlaying(pending.code, clientId, set, get);
        } catch (e) {
          // The offer was a snapshot of a moment; somebody may have taken the
          // chair since. Refresh what is on screen rather than leave a list
          // that is no longer true.
          set({ error: message(e) });
          await refreshOffers(set, get);
        } finally {
          set({ busy: false });
        }
      },

      /**
       * The spectator door. Nothing is written to the database: standing in
       * a room is a fact about the channel, not about the game. The name
       * travels in this device's presence payload, every client rebuilds the
       * list from the channel on each sync, and the tab caches it so a
       * reload does not empty it.
       */
      watch: async () => {
        const pending = get().pending;
        if (!pending) return;
        set({ busy: true, error: null });
        try {
          const clientId = await ensureSession();
          set({ clientId, myName: pending.name, pending: null });
          await enterPlaying(pending.code, clientId, set, get);
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
          set({ myName: name });
          // The presence payload carries the name to the roster panel, so it
          // has to follow a rename rather than keep announcing the old one.
          void channel?.track({ at: Date.now(), name } satisfies WatchPresence);
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
          set({ status: "playing", version: 1, seatOrder });
          // The seating just froze: whoever held a seat is a player now, and
          // everybody left standing is a spectator.
          syncWatchers();
          channel?.send({ type: "broadcast", event: "room", payload: { k: "start" } satisfies Wire });
          adopt(game, seatOrder, clientId);
        } catch (e) {
          set({ error: message(e) });
        } finally {
          set({ busy: false });
        }
      },

      leave: async () => {
        const { code, clientId } = get();
        setActionRelay(null);
        stopHeartbeat();

        // Torn down last, and detached first. Closing the socket takes long
        // enough to matter — it was doing so before the row below had been
        // deleted, so pressing Quitter left the chair looking occupied and
        // the room remembered for the next reload.
        const closing = channel;
        channel = null;

        set({
          code: null,
          clientId: null,
          hostId: null,
          status: "lobby",
          seats: [],
          seatOrder: [],
          present: [],
          myName: null,
          watchers: [],
          version: 0,
          pending: null,
          messages: [],
          unread: 0,
        });

        try {
          // Dropping the lobby that goes with it, when there is one, is the
          // function's business rather than this one's.
          if (code && clientId) await leaveRoom(code);
        } catch (e) {
          // The seat will be freed by the room giving up on it instead, which
          // takes a minute or so. Worth saying rather than swallowing.
          pushToast(`Le salon n'a pas pu être prévenu : ${message(e)}`, "bad");
        } finally {
          if (closing) await supabase().removeChannel(closing);
        }
      },

      restore: async () => {
        const code = get().code;
        if (!code || get().reconnecting) return;
        set({ reconnecting: true, error: null });
        try {
          const clientId = await ensureSession();
          const found = await fetchRoomAndSeats(code);

          // Gone for good: a host who closed the lobby, or the daily sweep.
          // The board on this device cannot be played on alone.
          if (!found) {
            setActionRelay(null);
            set({ code: null, clientId: null, seats: [], seatOrder: [], present: [], myName: null, watchers: [] });
            useGame.getState().goHome();
            pushToast("Le salon n'existe plus", "bad");
            return;
          }

          const { room, seats } = found;
          set({
            clientId,
            hostId: room.hostId,
            status: room.status,
            seats,
            seatOrder: room.seatOrder,
            version: room.version,
          });

          if (room.status === "lobby") {
            await connect(code, clientId, set, get);
            await refreshSeats(code, set);
            return;
          }

          // Your own chair is always yours, however long the tab was shut.
          const seat = room.seatOrder.indexOf(clientId);
          if (seat >= 0) await resumeSeat(code, seat);
          await enterPlaying(code, clientId, set, get);
        } catch (e) {
          // Anything else — no signal, a server having a moment — leaves the
          // room where it is and the guard in place, so the player can try
          // again from the settings panel rather than lose the evening.
          set({ error: message(e) });
          pushToast("Reconnexion impossible pour l'instant", "bad");
        } finally {
          set({ reconnecting: false });
        }
      },
    }),
    {
      name: "dakaropoly/room",
      /*
       * Per tab, like the identity it belongs to.
       *
       * The seat is held by an anonymous session living in `sessionStorage`,
       * so remembering the room anywhere longer-lived would have a second tab
       * try to walk back into a game it was never in, under an identity it
       * does not have.
       */
      storage: createJSONStorage(() => sessionStorage),
      /*
       * `myName` and the watchers come along for the ride. The name because
       * the reconnected device must announce itself with it again, and the
       * spectator list because it lives here, not in the database — a reload
       * should show the people standing in the room at once, and let the
       * first presence sync correct whoever has since slipped away.
       */
      partialize: (s) => ({
        code: s.code,
        myName: s.myName,
        watchers: s.watchers,
        // The conversation comes back with the tab. Losing what was just said
        // to a refresh is the one thing a chat must not do.
        messages: s.messages.slice(-CHAT_KEEP),
      }),
      onRehydrateStorage: () => (state) => {
        // Installed here rather than after the first render: the board comes
        // back from storage ready to play, and nothing may be played until
        // the channel is back.
        if (state?.code) setActionRelay(refuseWhileOffline);
      },
    },
  ),
);

// Reaching the room from the browser console, in development only. Two tabs
// disagreeing about who is present is the characteristic failure here, and
// it is invisible from the interface.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __dakaroom?: unknown }).__dakaroom = () => useRoom.getState();
}

/* ------------------------------------------------------------------ */

type Setter = (partial: Partial<RoomState>) => void;

async function refreshSeats(code: string, set: Setter): Promise<void> {
  set({ seats: await fetchSeats(code) });
  // Who is standing depends on who is sitting: a fresh roster can turn a
  // watcher into a player, or the other way round.
  syncWatchers();
}

/**
 * Splits the channel's presence into the table and the people standing
 * behind it, and stores the standing ones as the room's watchers.
 *
 * A spectator has no row anywhere: the channel says they are here, and the
 * name is whatever their own device put in its presence payload. Everyone
 * left out of the seating — every id in the lobby's roster, and every id in
 * a started game's `seat_order` — is at the table; the rest are watching.
 */
function syncWatchers(): void {
  const state = channel?.presenceState() ?? {};
  const { seatOrder, seats } = useRoom.getState();
  const seated = new Set<string>(seatOrder);
  for (const s of seats) if (s.seat !== null) seated.add(s.clientId);

  const watchers: Watcher[] = [];
  for (const [clientId, metas] of Object.entries(state)) {
    if (seated.has(clientId)) continue;
    // `unknown` because the payload is whatever some device chose to track;
    // anything that is not a usable string reads as an unnamed spectator.
    const name = (metas[0] as Partial<WatchPresence> | undefined)?.name;
    watchers.push({ clientId, name: typeof name === "string" && name ? name : "Un spectateur" });
  }
  watchers.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  useRoom.setState({ present: Object.keys(state), watchers });
}

/** Re-reads the table behind an offer list that has just been refused. */
async function refreshOffers(set: Setter, get: () => RoomState): Promise<void> {
  const pending = get().pending;
  const clientId = get().clientId;
  if (!pending || !clientId) return;
  const found = await fetchRoomAndSeats(pending.code);
  if (!found) return;
  set({ pending: { ...pending, offers: seatOffers(found.room, found.seats, clientId) } });
}

/** Seats the local device and hands the board over to the game store. */
function adopt(game: GameState, seatOrder: string[], clientId: string): void {
  const seat = seatOrder.indexOf(clientId);
  useGame.getState().adoptGame(game, seat === -1 ? null : seat);
}

/** Subscribes, then takes up the board as the room currently holds it. */
async function enterPlaying(
  code: string,
  clientId: string,
  set: Setter,
  get: () => RoomState,
): Promise<void> {
  // The code is what says this device is *in* a room: it is what the settings
  // panel shows, what leaving needs, and the one thing kept for the life of
  // the tab so a reload comes back here rather than to the title screen.
  set({ code });
  await connect(code, clientId, set, get);
  await refreshSeats(code, set);
  const found = await fetchRoomAndSeats(code);
  if (!found?.room.state) return;
  set({ status: found.room.status, version: found.room.version, seatOrder: found.room.seatOrder });
  adopt(found.room.state, found.room.seatOrder, clientId);
  // The seating was read after the presence sync that carried this device in,
  // so the standing-and-sitting split is worked out once more here.
  syncWatchers();
  channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
}

/**
 * Pulls the authoritative snapshot and rebuilds from it. Used when a message
 * arrives out of order, which the determinism of the engine makes unlikely
 * but not impossible — a dropped broadcast is enough.
 */
async function resync(code: string, clientId: string, set: Setter): Promise<void> {
  const found = await fetchRoomAndSeats(code);
  if (!found?.room.state) return;
  set({ version: found.room.version, status: found.room.status, seatOrder: found.room.seatOrder });
  adopt(found.room.state, found.room.seatOrder, clientId);
  syncWatchers();
}

function stopHeartbeat(): void {
  if (heartbeat !== null) clearInterval(heartbeat);
  heartbeat = null;
}

/**
 * Reports in on a timer. A chair only comes free when nothing has been heard
 * from the device holding it, so silence has to be earned: a tab left open on
 * a locked phone keeps its seat, a tab that is gone gives it up.
 */
function startHeartbeat(code: string): void {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    void touchSeat(code).catch(() => {
      // A missed beat is not worth a message: the next one is twenty seconds
      // away and the threshold is nearly four times that.
    });
  }, HEARTBEAT_MS);
}

/** Whoever this client id belongs to, named as the table knows them. */
function nameFor(clientId: string, get: () => RoomState): string {
  const seat = get().seats.find((s) => s.clientId === clientId);
  if (seat) return seat.name;
  // A spectator has no row to read a name from; the roster panel carries
  // theirs, from the name in their own presence payload.
  const watcher = get().watchers.find((w) => w.clientId === clientId);
  if (watcher) return watcher.name;
  const index = get().seatOrder.indexOf(clientId);
  return useGame.getState().game?.players[index]?.name ?? "Un joueur";
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

  // Subscribing replays everyone already in the room as an arrival. Greeting
  // them would announce the whole table to whoever just walked in.
  const quietUntil = Date.now() + 1500;

  channel.on("broadcast", { event: "room" }, ({ payload }) => {
    void handle(payload as Wire, code, clientId, set, get);
  });

  channel.on("presence", { event: "sync" }, () => {
    syncWatchers();
  });

  // Announced only once play has begun. In the lobby the roster says it
  // better, and the slips are not even mounted on that screen.
  const announce = (text: string, tone: "good" | "bad"): void => {
    if (get().status !== "lobby") pushToast(text, tone);
  };

  channel.on("presence", { event: "join" }, ({ key }) => {
    if (Date.now() < quietUntil || key === clientId) return;
    void refreshSeats(code, set).then(() => announce(`${nameFor(key, get)} a rejoint la partie`, "good"));
  });

  channel.on("presence", { event: "leave" }, ({ key }) => {
    if (Date.now() < quietUntil || key === clientId) return;
    // Named before the roster is refreshed: the row of a player who left for
    // good is about to disappear from it.
    const who = nameFor(key, get);
    announce(`${who} a quitté la partie`, "bad");
    void refreshSeats(code, set);
  });

  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      // The name rides along in the payload because a spectator writes no
      // row anywhere: presence is all the room will ever have of them, and
      // it has to say who they are.
      await channel?.track({ at: Date.now(), name: get().myName } satisfies WatchPresence);
    }
  });

  startHeartbeat(code);
  void touchSeat(code).catch(() => undefined);

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
      const found = await fetchRoomAndSeats(code);
      if (!found?.room.state) return;
      set({ status: found.room.status, version: found.room.version, seatOrder: found.room.seatOrder });
      adopt(found.room.state, found.room.seatOrder, clientId);
      // Kickoff freezes the seating, and whoever was standing when it froze
      // is a spectator from here on.
      syncWatchers();
      return;
    }

    case "resync":
      await resync(code, clientId, set);
      return;

    case "chat": {
      const { messages, unread } = get();
      // The sender gets its own message back like everyone else, so a repeat
      // would show twice rather than not at all.
      if (messages.some((m) => m.id === msg.msg.id)) return;
      const shut = !useGame.getState().chatOpen;
      set({
        messages: [...messages, msg.msg].slice(-CHAT_KEEP),
        unread: shut && msg.msg.clientId !== clientId ? unread + 1 : unread,
      });
      if (shut && msg.msg.clientId !== clientId) sfx.play("card");
      return;
    }

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
