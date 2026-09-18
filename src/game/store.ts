import { create } from "zustand";
import { applyAction, createGame } from "./engine";
import { CARDS_BY_ID } from "./data/cards";
import { sfx } from "../audio/sounds";
import type { Action, CardDef, GameEvent, GameState } from "./types";

export interface Toast {
  id: number;
  text: string;
  tone: "good" | "bad" | "info";
}

export type Screen = "home" | "setup" | "game" | "over";

interface Store {
  screen: Screen;
  game: GameState | null;
  visPos: Record<number, number>;
  dice: { a: number; b: number; rolling: boolean } | null;
  cardView: { deck: "chance" | "chest"; card: CardDef } | null;
  cardResolve: (() => void) | null;
  toasts: Toast[];
  rainKey: number;
  soundOn: boolean;
  manageOpen: boolean;
  tradeOpen: boolean;
  logOpen: boolean;
  openSetup: () => void;
  goHome: () => void;
  startGame: (defs: { name: string; pawn: number }[]) => void;
  dispatch: (action: Action) => void;
  ackCard: () => void;
  toggleSound: () => void;
  toggleManage: () => void;
  toggleTrade: () => void;
  toggleLog: () => void;
}

let queue: GameEvent[] = [];
let pumping = false;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function pushToast(text: string, tone: Toast["tone"]): void {
  const t: Toast = { id: Date.now() + Math.random(), text, tone };
  useGame.setState((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => {
    useGame.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
  }, 2800);
}

function enqueue(events: GameEvent[]): void {
  queue.push(...events);
  void pump();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const ev = queue.shift() as GameEvent;
      await handleEvent(ev);
    }
  } finally {
    pumping = false;
  }
}

async function handleEvent(ev: GameEvent): Promise<void> {
  switch (ev.t) {
    case "roll-dice": {
      sfx.play("dice");
      useGame.setState({ dice: { a: ev.a, b: ev.b, rolling: true } });
      await sleep(1050);
      useGame.setState((s) => ({ dice: s.dice ? { ...s.dice, rolling: false } : null }));
      await sleep(420);
      return;
    }
    case "move-steps": {
      const sign = Math.sign(ev.steps);
      for (let i = 0; i < Math.abs(ev.steps); i++) {
        const st = useGame.getState();
        const cur = st.visPos[ev.player] ?? 0;
        useGame.setState({ visPos: { ...st.visPos, [ev.player]: (cur + sign + 40) % 40 } });
        sfx.play("step");
        await sleep(195);
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
        sfx.play("cash");
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
    case "unmortgage":
      sfx.play("buzzer");
      await sleep(280);
      return;
    case "transfer":
      sfx.play("coin");
      await sleep(300);
      return;
    case "turn":
      useGame.setState({ dice: null, cardView: null, manageOpen: false, tradeOpen: false });
      return;
    case "winner":
      await sleep(1000);
      useGame.setState({ screen: "over" });
      return;
    case "toast":
    case "sound":
      return;
    default:
      return;
  }
}

export const useGame = create<Store>((set, get) => ({
  screen: "home",
  game: null,
  visPos: {},
  dice: null,
  cardView: null,
  cardResolve: null,
  toasts: [],
  rainKey: 0,
  soundOn: true,
  manageOpen: false,
  tradeOpen: false,
  logOpen: false,
  openSetup: () => set({ screen: "setup" }),
  goHome: () => {
    queue = [];
    set({
      screen: "home",
      game: null,
      visPos: {},
      dice: null,
      cardView: null,
      cardResolve: null,
      manageOpen: false,
      tradeOpen: false,
      logOpen: false,
      rainKey: 0,
    });
  },
  startGame: (defs) => {
    queue = [];
    const game = createGame(defs);
    const visPos: Record<number, number> = {};
    for (const p of game.players) visPos[p.id] = 0;
    set({
      screen: "game",
      game,
      visPos,
      dice: null,
      cardView: null,
      cardResolve: null,
      manageOpen: false,
      tradeOpen: false,
      logOpen: false,
      rainKey: 0,
    });
  },
  dispatch: (action) => {
    const game = get().game;
    if (!game) return;
    try {
      const res = applyAction(game, action);
      set({ game: res.state });
      enqueue(res.events);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Action impossible", "bad");
    }
  },
  ackCard: () => {
    const game = get().game;
    if (!game || game.phase !== "card") return;
    const resolve = get().cardResolve;
    set({ cardResolve: null, cardView: null });
    try {
      const res = applyAction(game, { t: "ack-card" });
      set({ game: res.state });
      enqueue(res.events);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Action impossible", "bad");
    }
    resolve?.();
  },
  toggleSound: () => {
    const next = !get().soundOn;
    sfx.enabled = next;
    set({ soundOn: next });
  },
  toggleManage: () => set((s) => ({ manageOpen: !s.manageOpen })),
  toggleTrade: () => set((s) => ({ tradeOpen: !s.tradeOpen })),
  toggleLog: () => set((s) => ({ logOpen: !s.logOpen })),
}));
