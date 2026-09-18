import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyAction, createGame } from "./engine";
import { CARDS_BY_ID } from "./data/cards";
import { sfx } from "../audio/sounds";
import { simulateThrow, type DiceThrow } from "../animation/diceRoll";
import type { Action, AnnounceKind, CardDef, GameEvent, GameState, SoundName } from "./types";

export interface Toast {
  id: number;
  text: string;
  tone: "good" | "bad" | "info";
}

export type Screen = "home" | "setup" | "online" | "game" | "over";

/** Whether the online screen opens on creating a room or joining one. */
export type OnlineMode = "create" | "join";

/** Which face of the left roster is showing. */
export type RosterTab = "players" | "spectators";

/** Pacing and audio the player can tune from the settings panel. */
export interface Settings {
  /** How long a paper slip stays pinned, in milliseconds. */
  toastDuration: number;
  /** How long an announcement card holds the queue, in milliseconds. */
  announceDuration: number;
  /** Time a token takes to hop one tile, in milliseconds. */
  stepDuration: number;
  /** Master volume, 0 to 1. */
  volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  toastDuration: 4500,
  announceDuration: 3000,
  stepDuration: 195,
  volume: 0.8,
};

export interface Announcement {
  kind: AnnounceKind;
  title: string;
  detail: string;
  amount?: number;
}

interface Store {
  screen: Screen;
  game: GameState | null;
  /**
   * Whether this board is being played across devices.
   *
   * Kept apart from `localPlayerId` because a spectator online has no seat
   * either, and reading `null` as "speaks for everyone" would hand them the
   * whole table.
   */
  online: boolean;
  /**
   * Which seat this device speaks for. `null` in a hot-seat game, where it
   * speaks for whoever's turn it is, and `null` again for a spectator, who
   * speaks for nobody — `online` is what tells the two apart.
   */
  localPlayerId: number | null;
  visPos: Record<number, number>;
  dice: { a: number; b: number; rolling: boolean } | null;
  /** Recorded physics for the throw in flight, replayed by the 3D dice. */
  diceThrow: { recording: DiceThrow; startedAt: number } | null;
  cardView: { deck: "chance" | "chest"; card: CardDef } | null;
  cardResolve: (() => void) | null;
  /** Card shown for a thing that happened *to* the player; auto-dismisses. */
  announcement: Announcement | null;
  /**
   * True while the event queue is playing. Contextual panels wait for it,
   * so a property card never appears before its token has arrived.
   */
  animating: boolean;
  settings: Settings;
  settingsOpen: boolean;
  /** Leaving a game in progress throws it away, so it is confirmed first. */
  confirmQuitOpen: boolean;
  toasts: Toast[];
  rainKey: number;
  soundOn: boolean;
  manageOpen: boolean;
  tradeOpen: boolean;
  logOpen: boolean;
  /** The written chat, online only. View state, like the journal beside it. */
  chatOpen: boolean;
  /**
   * The left roster: folded to a tab to clear the board, and which of its
   * two faces — players or spectators — is showing. View only, and not
   * saved: it says how the screen looks, not which game it is.
   */
  rosterOpen: boolean;
  rosterTab: RosterTab;
  toggleRoster: () => void;
  setRosterTab: (tab: RosterTab) => void;
  openSetup: () => void;
  onlineMode: OnlineMode;
  /** `code` pre-fills the field when arriving from a shared link. */
  openOnline: (mode: OnlineMode, code?: string) => void;
  pendingCode: string;
  goHome: () => void;
  /** `seed` is supplied online so every client builds the same board. */
  startGame: (defs: { name: string; pawn: number }[], seed?: number) => void;
  /**
   * Takes on a game that was built elsewhere — the authoritative snapshot of
   * an online room, either at kickoff or after a resync. A `null` seat is a
   * spectator: they watch the same board and never act on it.
   */
  adoptGame: (game: GameState, localPlayerId: number | null) => void;
  /** Plays an action here and now. Online this is driven by the wire. */
  applyLocally: (action: Action) => void;
  /** Plays an action, or sends it if this game is online. */
  dispatch: (action: Action) => void;
  ackCard: () => void;
  toggleSound: () => void;
  toggleManage: () => void;
  toggleTrade: () => void;
  toggleLog: () => void;
  toggleChat: () => void;
  toggleSettings: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  askQuit: () => void;
  cancelQuit: () => void;
}

const ANNOUNCE_SOUND: Record<AnnounceKind, SoundName> = {
  tax: "pay",
  rent: "pay",
  jail: "jail",
  bankruptcy: "bankrupt",
};

/** Longest a single walk may take, however far the card sends the token. */
const WALK_BUDGET = 1800;

let queue: GameEvent[] = [];
let pumping = false;

/**
 * Where actions go when the game is online. `null` in a hot-seat game, in
 * which case `dispatch` applies them directly and nothing about the local
 * game changes. The network layer installs itself here on joining a room and
 * removes itself on leaving.
 */
type ActionRelay = (action: Action) => void;
let relay: ActionRelay | null = null;

export function setActionRelay(next: ActionRelay | null): void {
  relay = next;
}

// Reaching the store from the browser console, in development only. The
// animation queue is the hardest part of this app to reason about from the
// outside, and being able to read `visPos` against `animating` while a turn
// plays is worth the four lines.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __dakaropoly?: unknown }).__dakaropoly = () => useGame.getState();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Pins a paper slip in the corner. Exported because the network layer has
 * things to say that the engine never will — somebody leaving the room, a
 * connection coming back — and they belong in the same running commentary
 * as everything else that happens at the table.
 */
export function pushToast(text: string, tone: Toast["tone"]): void {
  const t: Toast = { id: Date.now() + Math.random(), text, tone };
  useGame.setState((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => {
    useGame.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
  }, useGame.getState().settings.toastDuration);
}

function enqueue(events: GameEvent[]): void {
  queue.push(...events);
  void pump();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  useGame.setState({ animating: true });
  try {
    while (queue.length > 0) {
      const ev = queue.shift() as GameEvent;
      await handleEvent(ev);
    }
  } finally {
    pumping = false;
    useGame.setState({ animating: false });
  }
}

async function handleEvent(ev: GameEvent): Promise<void> {
  switch (ev.t) {
    case "roll-dice": {
      sfx.play("dice");
      // The engine already drew the result; the throw is simulated for real
      // and the pips are painted on afterwards, so the physics stays honest.
      const turn = useGame.getState().game?.turnCount ?? 0;
      const recording = simulateThrow(ev.a, ev.b, (ev.a * 31 + ev.b) * 7919 + turn);
      useGame.setState({
        dice: { a: ev.a, b: ev.b, rolling: true },
        diceThrow: { recording, startedAt: performance.now() },
      });
      await sleep(recording.duration * 1000);
      useGame.setState((s) => ({ dice: s.dice ? { ...s.dice, rolling: false } : null }));
      await sleep(430);
      return;
    }
    case "move-steps": {
      const sign = Math.sign(ev.steps);
      const steps = Math.abs(ev.steps);
      for (let i = 0; i < steps; i++) {
        const st = useGame.getState();
        const cur = st.visPos[ev.player] ?? 0;
        useGame.setState({ visPos: { ...st.visPos, [ev.player]: (cur + sign + 40) % 40 } });
        sfx.play("step");
        // A card can send a token most of the way round the board, which at
        // the ordinary pace would be seven seconds of hopping. Long moves
        // scamper instead, so the whole journey stays watchable.
        const pace = useGame.getState().settings.stepDuration;
        await sleep(Math.min(pace, Math.max(45, WALK_BUDGET / steps)));
      }
      return;
    }
    case "teleport": {
      sfx.play("teleport");
      useGame.setState((s) => ({ visPos: { ...s.visPos, [ev.player]: ev.pos } }));
      await sleep(560);
      return;
    }
    case "money": {
      if (ev.amount >= 0) {
        sfx.play("register");
        if (ev.amount >= 300) useGame.setState({ rainKey: Date.now() });
      } else {
        sfx.play("pay");
      }
      return;
    }
    case "show-card": {
      sfx.play("card");
      useGame.setState({ cardView: { deck: ev.deck, card: CARDS_BY_ID[ev.cardId] as CardDef } });
      await new Promise<void>((resolve) => {
        useGame.setState({ cardResolve: resolve });
      });
      return;
    }
    case "jail-in": {
      sfx.play("jail");
      useGame.setState((s) => ({ visPos: { ...s.visPos, [ev.player]: 10 } }));
      await sleep(640);
      return;
    }
    case "jail-out": {
      sfx.play("coin");
      await sleep(380);
      return;
    }
    case "buy":
      sfx.play("buy");
      await sleep(320);
      return;
    case "build":
      sfx.play("build");
      await sleep(300);
      return;
    case "mortgage":
      sfx.play("mortgage");
      await sleep(280);
      return;
    case "unmortgage":
      sfx.play("unmortgage");
      await sleep(280);
      return;
    case "auction-start":
      sfx.play("gavel");
      await sleep(420);
      return;
    case "auction-end":
      sfx.play("gavel");
      await sleep(320);
      return;
    case "transfer":
      sfx.play("coin");
      await sleep(300);
      return;
    case "turn":
      useGame.setState({ dice: null, diceThrow: null, cardView: null, manageOpen: false, tradeOpen: false });
      return;
    case "winner":
      sfx.play("win");
      await sleep(1400);
      useGame.setState({ screen: "over" });
      return;
    case "announce": {
      sfx.play(ANNOUNCE_SOUND[ev.kind]);
      useGame.setState({ announcement: ev });
      await sleep(useGame.getState().settings.announceDuration);
      useGame.setState({ announcement: null });
      await sleep(180);
      return;
    }
    case "toast":
      pushToast(ev.text, ev.tone);
      return;
    case "sound":
      sfx.play(ev.name);
      return;
    default:
      return;
  }
}

/** What survives a page reload. Everything else is rebuilt on rehydrate. */
interface PersistedState {
  screen: Screen;
  game: GameState | null;
  /**
   * Kept across a reload because they say which game this is, not how it
   * looks: a device that came back from an online room owning nobody would
   * behave as a hot-seat game and let its player act for the whole table.
   */
  online: boolean;
  localPlayerId: number | null;
  soundOn: boolean;
  settings: Settings;
}

/**
 * A saved game is only worth restoring if it still looks like one. A partial
 * write, or a save from an older shape of `GameState`, is discarded rather
 * than dropping the player into a broken board.
 */
function isRestorable(game: GameState | null): game is GameState {
  return (
    !!game &&
    Array.isArray(game.players) &&
    game.players.length >= 2 &&
    Array.isArray(game.tiles) &&
    game.tiles.length === 40 &&
    typeof game.current === "number" &&
    !!game.players[game.current]
  );
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
    screen: "home",
    game: null,
    online: false,
    localPlayerId: null,
    visPos: {},
    dice: null,
    diceThrow: null,
    cardView: null,
    cardResolve: null,
    announcement: null,
    animating: false,
    settings: DEFAULT_SETTINGS,
    settingsOpen: false,
    confirmQuitOpen: false,
    toasts: [],
    rainKey: 0,
    soundOn: true,
    manageOpen: false,
    tradeOpen: false,
    logOpen: false,
    chatOpen: false,
    rosterOpen: true,
    rosterTab: "players",
    toggleRoster: () => set((s) => ({ rosterOpen: !s.rosterOpen })),
    setRosterTab: (rosterTab) => set({ rosterTab }),
    openSetup: () => set({ screen: "setup" }),
    onlineMode: "create",
    pendingCode: "",
    openOnline: (mode, code = "") =>
      set({ screen: "online", onlineMode: mode, pendingCode: code }),
    goHome: () => {
      queue = [];
      // Leaving while a card is on the table would strand the pump on a
      // promise nobody is left to settle, and `pumping` would stay true for
      // the rest of the session — every later game silently refusing to
      // animate. Release it before dropping the reference.
      get().cardResolve?.();
      set({
        screen: "home",
        game: null,
        online: false,
        localPlayerId: null,
        visPos: {},
        dice: null,
        diceThrow: null,
        cardView: null,
        cardResolve: null,
        announcement: null,
        animating: false,
        settingsOpen: false,
        confirmQuitOpen: false,
        manageOpen: false,
        tradeOpen: false,
        logOpen: false,
        chatOpen: false,
        rosterOpen: true,
        rosterTab: "players",
        rainKey: 0,
      });
    },
    startGame: (defs, seed) => {
      queue = [];
      get().cardResolve?.();
      // The seed is drawn here rather than inside the engine: online, every
      // client must build the identical board from a seed agreed in the lobby.
      const game = createGame(defs, seed ?? Math.floor(Math.random() * 2147483647));
      const visPos: Record<number, number> = {};
      for (const p of game.players) visPos[p.id] = 0;
      set({
        screen: "game",
        game,
        online: false,
        localPlayerId: null,
        visPos,
        dice: null,
        diceThrow: null,
        cardView: null,
        cardResolve: null,
        announcement: null,
        animating: false,
        settingsOpen: false,
        confirmQuitOpen: false,
        manageOpen: false,
        tradeOpen: false,
        logOpen: false,
        chatOpen: false,
        rosterOpen: true,
        rosterTab: "players",
        rainKey: 0,
      });
    },
    adoptGame: (game, localPlayerId) => {
      queue = [];
      get().cardResolve?.();
      const visPos: Record<number, number> = {};
      for (const p of game.players) visPos[p.id] = p.position;
      const pending = game.card;
      const card = pending ? CARDS_BY_ID[pending.cardId] : undefined;
      set({
        screen: game.phase === "game-over" ? "over" : "game",
        game,
        online: true,
        localPlayerId,
        visPos,
        dice: null,
        diceThrow: null,
        // A card left on the table blocks every action until acknowledged, so
        // a client arriving mid-draw has to see it too.
        cardView: pending && card ? { deck: pending.deck, card } : null,
        cardResolve: null,
        announcement: null,
        animating: false,
        settingsOpen: false,
        confirmQuitOpen: false,
        manageOpen: false,
        tradeOpen: false,
        logOpen: false,
        chatOpen: false,
        rosterOpen: true,
        rosterTab: "players",
        rainKey: 0,
      });
    },
    applyLocally: (action) => {
      const game = get().game;
      if (!game) return;
      try {
        const res = applyAction(game, action);
        set({ game: res.state });
        enqueue(res.events);
        if (action.t === "ack-card") {
          // The queue is parked on this promise. Release it *after* the
          // follow-up events are queued, so the pump runs straight on
          // rather than draining, stopping, and starting again.
          const resolve = get().cardResolve;
          set({ cardResolve: null, cardView: null });
          resolve?.();
        }
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Action impossible", "bad");
      }
    },
    dispatch: (action) => {
      // A spectator has a relay like everyone else, and anything they sent
      // would be replayed by the whole room. The HUD gives them no buttons,
      // so reaching here means something slipped through rather than that
      // they meant it.
      if (get().online && get().localPlayerId === null) {
        pushToast("Vous suivez la partie en spectateur", "info");
        return;
      }
      // Online, an action is not applied where it is played: it goes out on
      // the wire and every client — this one included — applies it when it
      // comes back, so all devices replay the same sequence in the same
      // order. With no relay installed this is the hot-seat path, unchanged.
      if (relay) {
        relay(action);
        return;
      }
      get().applyLocally(action);
    },
    ackCard: () => {
      const game = get().game;
      if (!game || game.phase !== "card") return;
      get().dispatch({ t: "ack-card" });
    },
    toggleSound: () => {
      const next = !get().soundOn;
      sfx.enabled = next;
      set({ soundOn: next });
    },
    toggleManage: () => set((s) => ({ manageOpen: !s.manageOpen })),
    toggleTrade: () => set((s) => ({ tradeOpen: !s.tradeOpen })),
    toggleLog: () => set((s) => ({ logOpen: !s.logOpen })),
    toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  askQuit: () => set({ confirmQuitOpen: true }),
  cancelQuit: () => set({ confirmQuitOpen: false }),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    sfx.volume = settings.volume;
    set({ settings });
  },
    }),
    {
      name: "dakaropoly/save",
      version: 2,
      // A save written before offers could sit on the table has no
      // `pendingTrade`. Filling it in beats dropping an evening's game,
      // which is what a bare version bump would do.
      migrate: (persisted, from) => {
        const saved = persisted as PersistedState;
        if (from < 2 && saved.game && saved.game.pendingTrade === undefined) {
          saved.game.pendingTrade = null;
        }
        return saved;
      },
      // A Monopoly evening is long: only the board state is worth keeping.
      // Anything mid-animation is transient and is rebuilt on rehydrate.
      partialize: (s): PersistedState => ({
        screen: s.screen,
        game: s.game,
        online: s.online,
        localPlayerId: s.localPlayerId,
        soundOn: s.soundOn,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A save written before a setting existed must not leave it undefined.
        state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
        sfx.enabled = state.soundOn;
        sfx.volume = state.settings.volume;

        if (state.screen !== "game" && state.screen !== "over") return;

        if (!isRestorable(state.game)) {
          state.screen = "home";
          state.game = null;
          return;
        }

        // The animation queue did not survive the reload, so snap every token
        // to where the rules say it is rather than where it was mid-hop.
        const visPos: Record<number, number> = {};
        for (const player of state.game.players) visPos[player.id] = player.position;
        state.visPos = visPos;

        // A card left waiting to be acknowledged would otherwise be
        // unreachable: its phase blocks every action until it is dismissed.
        const pending = state.game.card;
        if (state.game.phase === "card" && pending) {
          const card = CARDS_BY_ID[pending.cardId];
          if (card) state.cardView = { deck: pending.deck, card };
        }
      },
    },
  ),
);
