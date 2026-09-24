import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Action, GameState } from "../game/types";
import { NAME_MAX } from "../game/types";
import { createGame } from "../game/engine";
import { pushToast, setActionRelay, useGame } from "../game/store";
import { sfx } from "../audio/sounds";
import { ensureSession, supabase } from "./supabase";
import {
  attachVoice,
  detachVoice,
  handleVoiceWire,
  mayTalk,
  syncVoicePeers,
  useVoice,
  voiceIsOn,
  voicePeers,
  type VoiceWire,
} from "./voice";
import {
  claimSeat,
  createRoom,
  formatCode,
  fetchRoomAndSeats,
  leaveRoom,
  pushSnapshot,
  renameSeat,
  setIdleTimeout,
  setSpectatorVoice,
  resumeSeat,
  seatOffers,
  seatOf,
  seatedInOrder,
  startRoom,
  touchSeat,
  DEFAULT_IDLE_SECONDS,
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
  | { k: "chat"; msg: ChatMessage }
  // Voice is dialled device to device; only the introductions come through
  // here, on the socket that is already open.
  | VoiceWire;

/**
 * Whether the writer of a message sat at the table or stood behind it at the
 * moment they wrote it. Recorded rather than looked up: a player who gave up
 * their chair halfway through the evening should not have everything they
 * said retroactively demoted to spectator talk.
 */
export type ChatRole = "player" | "spectator";

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
  /** Absent on messages persisted before the badge existed. */
  role?: ChatRole;
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
type WatchPresence = { at: number; name: string | null; voice: boolean };

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
  /** Whether the host lets the people standing behind the table speak. */
  spectatorVoice: boolean;
  /** How long the room outlives its last seated player, in seconds. */
  idleSeconds: number;
  /**
   * A host setting is on its way to the database. The controls wait for it:
   * a second tap on a switch whose first has not landed yet is how a toggle
   * ends up exactly where it started.
   */
  hostBusy: boolean;
  /**
   * Why this device was sent back to the title screen, when it was the room
   * that went rather than the player. Toasts are only mounted over the board,
   * so the home screen carries this one itself.
   */
  closedNotice: string | null;
  /**
   * This device came in through the spectator door and means to stay there.
   *
   * Kept because `seat_order` still names them: without it, reloading would
   * reclaim the chair they deliberately gave up.
   */
  watching: boolean;
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
  /** Takes a new name for this device, and for the chair it holds. */
  renameSelf: (name: string) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
  /** Picks the room back up after a reload, or after a failed attempt. */
  restore: () => Promise<void>;
  /** The host's switch for the spectators' microphones. */
  allowSpectatorVoice: (allowed: boolean) => Promise<void>;
  /** The host's choice of how long an empty room survives, in seconds. */
  setIdleTimeout: (seconds: number) => Promise<void>;
  dismissClosedNotice: () => void;
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
 * Everything that describes being in a room, emptied. Shared by leaving on
 * purpose and by finding the room gone, which must leave the same nothing
 * behind — a field one of them forgot is a field the next room inherits.
 */
const OUT_OF_ROOM = {
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
  spectatorVoice: false,
  idleSeconds: DEFAULT_IDLE_SECONDS,
  hostBusy: false,
  watching: false,
  messages: [],
  unread: 0,
} satisfies Partial<RoomState>;

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
      spectatorVoice: false,
      idleSeconds: DEFAULT_IDLE_SECONDS,
      hostBusy: false,
      closedNotice: null,
      watching: false,
      messages: [],
      unread: 0,

      clearError: () => set({ error: null }),
      markRead: () => set({ unread: 0 }),
      dismissClosedNotice: () => set({ closedNotice: null }),

      allowSpectatorVoice: async (allowed) => {
        const code = get().code;
        if (!code || get().hostBusy) return;
        const before = get().spectatorVoice;
        // Shown at once and taken back on refusal: waiting a round trip for a
        // switch to move reads as a switch that does not work.
        set({ spectatorVoice: allowed, hostBusy: true });
        try {
          await setSpectatorVoice(code, allowed);
          // Everyone re-reads the room, which is where the switch lives, so a
          // spectator who may no longer speak is dropped by every device.
          channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
          await refreshSeats(code, set);
        } catch (e) {
          // Mid-game `error` has no banner to land in, and a switch that
          // flips back without a word looks broken rather than refused.
          set({ spectatorVoice: before, error: message(e) });
          pushToast(message(e), "bad");
        } finally {
          set({ hostBusy: false });
        }
      },

      setIdleTimeout: async (seconds) => {
        const code = get().code;
        if (!code || get().hostBusy || seconds === get().idleSeconds) return;
        const before = get().idleSeconds;
        set({ idleSeconds: seconds, hostBusy: true });
        try {
          await setIdleTimeout(code, seconds);
          channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
          await refreshSeats(code, set);
        } catch (e) {
          set({ idleSeconds: before, error: message(e) });
          pushToast(message(e), "bad");
        } finally {
          set({ hostBusy: false });
        }
      },

      /**
       * Sent rather than appended: it comes back through the channel like
       * everything else, so a message appears here at the same moment it
       * appears for everyone — and if it never went out, it never shows.
       */
      say: (text) => {
        const trimmed = text.trim().slice(0, CHAT_MAX_CHARS);
        const { clientId, myName, seats } = get();
        if (!trimmed || !channel || !clientId) return;
        const msg: ChatMessage = {
          id: `${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          clientId,
          name: myName ?? "Un joueur",
          role: seats.some((s) => s.clientId === clientId && s.seat !== null) ? "player" : "spectator",
          text: trimmed,
          at: Date.now(),
        };
        void channel.send({ type: "broadcast", event: "room", payload: { k: "chat", msg } satisfies Wire });
      },
      cancelPending: () => set({ pending: null }),

      host: async (name, pawn) => {
        set({ busy: true, error: null, closedNotice: null });
        try {
          const clientId = await ensureSession();
          const code = await createRoom(clientId, name, pawn);
          set({ code, clientId, hostId: clientId, status: "lobby", myName: name, watching: false });
          await connect(code, clientId, set, get);
          await refreshSeats(code, set);
        } catch (e) {
          set({ error: message(e) });
        } finally {
          set({ busy: false });
        }
      },

      join: async (code, name, pawn) => {
        set({ busy: true, error: null, closedNotice: null });
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
          set({
            code,
            hostId: room.hostId,
            status: room.status,
            version: room.version,
            watching: pawn === null,
          });
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
          set({ clientId, pending: null, watching: false });
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
          set({ clientId, myName: pending.name, pending: null, watching: true });
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
          void channel?.track({ at: Date.now(), name, voice: voiceIsOn() } satisfies WatchPresence);
          await refreshSeats(code, set);
          channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
        } catch (e) {
          set({ error: message(e) });
        }
      },

      /**
       * Changing one's own name, and only one's own.
       *
       * A name is kept in three places, and a rename has to visit each of
       * them: the board, where the engine froze it at kickoff; the roster,
       * where the chair records who occupies it now; and presence, which is
       * all a spectator ever is to the room. The board's copy is not simply
       * overwritten here — it travels as an action every client replays, so
       * every screen renames at the same moment in the same order, and the
       * device that renamed writes the snapshot like any other action's.
       */
      renameSelf: async (name) => {
        const { code, clientId, seats, seatOrder } = get();
        if (!code || !clientId) return;
        const clean = name.trim().slice(0, NAME_MAX);
        if (!clean) {
          set({ error: "Il faut un nom pour que les autres vous reconnaissent" });
          return;
        }
        const seat = seatOf(seatOrder, seats, clientId);
        set({ myName: clean });
        void channel?.track({ at: Date.now(), name: clean, voice: voiceIsOn() } satisfies WatchPresence);
        try {
          // The roster first: the action below makes the snapshot carry the
          // new name, and a device that pulled the room in between should
          // find both halves agreeing, not one waiting on the other.
          await renameSeat(code, clean);
          if (seat !== null) {
            useGame.getState().dispatch({ t: "rename", playerId: seat, name: clean });
          }
          await refreshSeats(code, set);
          channel?.send({ type: "broadcast", event: "room", payload: { k: "roster" } satisfies Wire });
        } catch (e) {
          // The lobby reads `error` as a banner; mid-game the room panel is
          // the only surface, so the refusal has to find the toast lane.
          set({ error: message(e) });
          pushToast(message(e), "bad");
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
          // Kickoff renumbers the chairs from pawns to player numbers (see
          // `open_room`). The roster read before it still numbers them by
          // pawn, and a host whose pawn was not the lowest at the table
          // would have been seated as a spectator of their own game.
          const players = seated.map((s, i) => ({ ...s, seat: i }));
          set({
            status: "playing",
            version: 1,
            seatOrder,
            // Anybody else in the roster was not in the list, and stands.
            seats: [
              ...players,
              ...get()
                .seats.filter((s) => !seatOrder.includes(s.clientId))
                .map((s) => ({ ...s, seat: null })),
            ],
          });
          // The seating just froze: whoever held a seat is a player now, and
          // everybody left standing is a spectator.
          syncWatchers();
          channel?.send({ type: "broadcast", event: "room", payload: { k: "start" } satisfies Wire });
          adopt(game, seatOrder, players, clientId);
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
        detachVoice();

        // Torn down last, and detached first. Closing the socket takes long
        // enough to matter — it was doing so before the row below had been
        // deleted, so pressing Quitter left the chair looking occupied and
        // the room remembered for the next reload.
        const closing = channel;
        channel = null;

        set(OUT_OF_ROOM);

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

          // Gone for good: a host who closed the lobby, or a room left empty
          // past its timeout. The board on this device cannot be played on
          // alone.
          if (!found) {
            await closeGoneRoom(code);
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

          // Your own chair is always yours, however long the tab was shut —
          // unless you got up from it on purpose, in which case walking back
          // in must not sit you down again.
          const seat = get().watching ? -1 : room.seatOrder.indexOf(clientId);
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
        watching: s.watching,
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
  const found = await fetchRoomAndSeats(code);
  if (!found) {
    // Asked about our own room and told there is none: it was closed —
    // a host leaving the lobby, or a table left empty past its timeout.
    await closeGoneRoom(code);
    return;
  }
  const before = useRoom.getState().spectatorVoice;
  // Read before `syncWatchers`, which may hang this device up: the two must
  // not both tell a spectator the same news.
  const talking = useVoice.getState().active;
  set({
    seats: found.seats,
    // The host is re-read with everything else. Only the paths through
    // `host`, `join` and `restore` used to set it, so a host who came back
    // through the join form was no longer recognised as one — and lost the
    // only switches that are theirs to move.
    hostId: found.room.hostId,
    spectatorVoice: found.room.spectatorVoice,
    idleSeconds: found.room.idleSeconds,
  });
  // Who is standing depends on who is sitting: a fresh roster can turn a
  // watcher into a player, or the other way round.
  syncWatchers();
  announceSpectatorVoice(before, found.room.spectatorVoice, talking);
}

/**
 * Tells a spectator the host has just changed what they may do. The switch
 * lives in a panel they have no reason to open, and a microphone button that
 * silently comes alive — or dies — reads as the interface misbehaving.
 */
function announceSpectatorVoice(before: boolean, now: boolean, talking: boolean): void {
  const { status, clientId, seats } = useRoom.getState();
  if (before === now || status === "lobby" || !clientId) return;
  if (seats.some((s) => s.clientId === clientId && s.seat !== null)) return;
  // Somebody cut off mid-sentence has already been told, by `syncWatchers`.
  if (!now && talking) return;
  pushToast(now ? "L'hôte a ouvert le micro aux spectateurs" : "L'hôte a réservé le micro aux joueurs", "info");
}

/**
 * The room this device was in no longer exists. Everything that assumed it
 * did — the relay, the heartbeat, the call, the channel — is taken down, and
 * the player is sent home with the reason, since a board that nobody else
 * shares any more cannot be played on.
 *
 * Only for the room we are actually in: an answer about a room this device
 * has since left, arriving late, must not throw it out of the next one.
 */
async function closeGoneRoom(code: string): Promise<void> {
  if (useRoom.getState().code !== code) return;
  setActionRelay(null);
  stopHeartbeat();
  detachVoice();
  const closing = channel;
  channel = null;
  useRoom.setState({
    ...OUT_OF_ROOM,
    // No duration in the sentence: after a reload this device never read the
    // room's timeout, and a wrong figure is worse than none.
    closedNotice: `Le salon ${formatCode(code)} a été fermé : plus aucun joueur n'y était assis, ou son hôte l'a quitté avant le début de la partie.`,
  });
  useGame.getState().goHome();
  if (closing) await supabase().removeChannel(closing);
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
  // Rows only. Adding `seat_order` here is what hid a returning spectator
  // from their own list: the order still named them, so they counted as
  // sitting down when they were plainly standing up.
  const { seats } = useRoom.getState();
  const seated = new Set<string>();
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

  // Who has a microphone open falls out of the same pass: somebody joining
  // the call, leaving it, or closing their laptop all arrive here.
  const { clientId: selfId, spectatorVoice } = useRoom.getState();
  if (selfId) {
    const heard = Object.entries(state).map(([clientId, metas]) => ({
      clientId,
      voice: (metas[0] as Partial<WatchPresence> | undefined)?.voice === true,
      seated: seated.has(clientId),
    }));
    syncVoicePeers(voicePeers(heard, selfId, spectatorVoice));

    // And this device hangs up on itself rather than waiting to be ignored:
    // the host can withdraw the permission while somebody is mid-sentence.
    if (!mayTalk(seated.has(selfId), spectatorVoice) && useVoice.getState().active) {
      useVoice.getState().stop();
      pushToast("L'hôte a réservé le micro aux joueurs", "info");
    }
  }
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

/**
 * Seats the local device and hands the board over to the game store.
 *
 * The roster has the last word. `seat_order` still names a player who left,
 * so taking it at face value sat a returning spectator straight back down at
 * their old chair — see `seatOf`.
 */
function adopt(game: GameState, seatOrder: string[], seats: Seat[], clientId: string): void {
  useGame.getState().adoptGame(game, seatOf(seatOrder, seats, clientId));
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
  set({
    status: found.room.status,
    version: found.room.version,
    seatOrder: found.room.seatOrder,
    seats: found.seats,
  });
  adopt(found.room.state, found.room.seatOrder, found.seats, clientId);
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
  set({
    version: found.room.version,
    status: found.room.status,
    seatOrder: found.room.seatOrder,
    seats: found.seats,
  });
  adopt(found.room.state, found.room.seatOrder, found.seats, clientId);
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
  heartbeat = setInterval(() => void beat(code), HEARTBEAT_MS);
}

/**
 * One report. The answer says whether the room is still there, which is how
 * a device that slept through the room's expiry finds out it has nowhere to
 * go back to.
 */
async function beat(code: string): Promise<void> {
  let alive = true;
  try {
    alive = await touchSeat(code);
  } catch {
    // A missed beat is not worth a message: the next one is twenty seconds
    // away and the threshold is nearly four times that.
    return;
  }
  if (!alive) await closeGoneRoom(code);
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

  // A device that re-publishes its presence — opening or closing its
  // microphone, taking a new name — reaches here too, as a join of the new
  // payload followed by a leave of the old one, under the same key. Announcing
  // those put "X a quitté la partie" then "X a rejoint la partie" on every
  // screen each time anybody touched their microphone. `currentPresences` is
  // what tells them apart: on a join it is what the key held *before*, on a
  // leave what it still holds *after* — either way non-empty means the device
  // never left.
  channel.on("presence", { event: "join" }, ({ key, currentPresences }) => {
    if (Date.now() < quietUntil || key === clientId || currentPresences.length > 0) return;
    void refreshSeats(code, set).then(() => announce(`${nameFor(key, get)} a rejoint la partie`, "good"));
  });

  channel.on("presence", { event: "leave" }, ({ key, currentPresences }) => {
    if (Date.now() < quietUntil || key === clientId || currentPresences.length > 0) return;
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
      await channel?.track({
        at: Date.now(),
        name: get().myName,
        voice: voiceIsOn(),
      } satisfies WatchPresence);
    }
  });

  startHeartbeat(code);
  void beat(code);

  attachVoice({
    selfId: clientId,
    send: (wire) => void channel?.send({ type: "broadcast", event: "room", payload: wire }),
    announce: () =>
      void channel?.track({
        at: Date.now(),
        name: get().myName,
        voice: voiceIsOn(),
      } satisfies WatchPresence),
    mayHear: (id) => {
      const { seats, spectatorVoice } = get();
      const seated = seats.some((s) => s.clientId === id && s.seat !== null);
      return mayTalk(seated, spectatorVoice);
    },
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
      const found = await fetchRoomAndSeats(code);
      if (!found?.room.state) return;
      set({
        status: found.room.status,
        version: found.room.version,
        seatOrder: found.room.seatOrder,
        seats: found.seats,
      });
      adopt(found.room.state, found.room.seatOrder, found.seats, clientId);
      // Kickoff freezes the seating, and whoever was standing when it froze
      // is a spectator from here on.
      syncWatchers();
      return;
    }

    case "resync":
      await resync(code, clientId, set);
      return;

    case "rtc":
      await handleVoiceWire(msg);
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
      // A rename names the player being renamed, and an id on the wire is
      // only as honest as the chair behind it: `seat_order` and the roster
      // together say which player `by` actually holds. A rename that does
      // not match our table is usually this device being a beat behind —
      // the roster broadcast and the action raced — so take the snapshot
      // rather than drop the action and drift: a dropped *state-changing*
      // action leaves this version counter agreeing while the board under
      // it quietly diverges.
      // Walking out of the game is held to the same rule: only the device in
      // the chair can resign it, or one stale screen could eliminate somebody
      // who never asked to leave.
      if (
        (msg.action.t === "rename" || msg.action.t === "resign") &&
        seatOf(get().seatOrder, get().seats, msg.by) !== msg.action.playerId
      ) {
        await resync(code, clientId, set);
        return;
      }
      const version = get().version;
      if (msg.from !== version) {
        // Someone is a step ahead or behind: trust the snapshot, not us.
        await resync(code, clientId, set);
        return;
      }
      if (!useGame.getState().applyLocally(msg.action)) {
        // The engine refused here what it took on the device that played it,
        // so this board is not where that one was. Counting the action as
        // played anyway would line every later `from` up against a version
        // this board never earned: the guard would agree for ever while the
        // two drifted apart, which is how one screen ends up naming a player
        // the other is waiting on. Take the snapshot instead.
        await resync(code, clientId, set);
        return;
      }
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
