/**
 * Headless game fuzzer — plays whole games with bots, from setup to a winner.
 *
 * Independent second opinion on `simulate.ts`: different bot policies (five
 * profiles, mixed inside a single table), every player count from 2 to 8, and
 * a much stricter invariant set — bank stock accounting, phase/payload
 * coherence, deck conservation, even-building, jail consistency.
 *
 *   bun scripts/fuzz.ts
 *   GAMES=400 bun scripts/fuzz.ts
 *   SEED_ONLY=12345 SEED_PLAYERS=4 TRACE=1 bun scripts/fuzz.ts
 */
import { createGame, applyAction, JAIL_FINE, HOUSE_STOCK_MAX, HOTEL_STOCK_MAX } from "../src/game/engine";
import type { Action, GameEvent, GameState, PendingTrade, Player, TileState } from "../src/game/types";
import { BOARD, GROUP_MEMBERS, tileAt } from "../src/game/data/board";
import { CARDS_BY_ID, DECK_IDS } from "../src/game/data/cards";
import {
  actorFor,
  canBuildOn,
  canMortgage,
  canSellHouseOn,
  canUnmortgage,
  ownedPositions,
  unmortgageCost,
} from "../src/game/selectors";

const MAX_TURNS = Number(process.env.MAX_TURNS ?? 2000);
const GAMES = Number(process.env.GAMES ?? 150);
const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8];

/** How a bot values property, cash and buildings. Mixed within one table. */
interface Profile {
  name: string;
  /** Cash kept back rather than spent on a purchase. */
  reserve: number;
  /** Highest auction bid, as a multiple of the printed price. */
  bidCeiling: number;
  /** Builds houses when it can afford to. */
  builds: boolean;
  /** Proposes and accepts trades. */
  trades: boolean;
  /** Pays its way out of jail rather than rolling for doubles. */
  buysOutOfJail: boolean;
  /**
   * Sells and mortgages to cover a debt. A bot that does not is not playing
   * badly — it is the impatient human who presses Faillite with hotels still
   * standing, which the HUD allows in one click.
   */
  liquidates: boolean;
}

const PROFILES: Profile[] = [
  { name: "tight", reserve: 250, bidCeiling: 0.8, builds: true, trades: true, buysOutOfJail: false, liquidates: true },
  { name: "greedy", reserve: 0, bidCeiling: 1.6, builds: true, trades: true, buysOutOfJail: true, liquidates: true },
  { name: "builder", reserve: 60, bidCeiling: 1.0, builds: true, trades: true, buysOutOfJail: true, liquidates: true },
  { name: "hoarder", reserve: 400, bidCeiling: 0.5, builds: false, trades: false, buysOutOfJail: false, liquidates: true },
  { name: "reckless", reserve: 0, bidCeiling: 2.2, builds: true, trades: true, buysOutOfJail: true, liquidates: true },
  { name: "impatient", reserve: 20, bidCeiling: 1.2, builds: true, trades: false, buysOutOfJail: true, liquidates: false },
];

/** Bot-side randomness, kept out of the engine's own seeded stream. */
function makeRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x9e3779b9) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- invariants

interface Violation {
  kind: string;
  detail: string;
  turn: number;
  phase: string;
}

/**
 * Violations that make the board unplayable rather than merely wrong. A bot
 * handed one of these cannot choose a legal action — the run stops there and
 * reports, instead of crashing on the state the engine left behind.
 */
const FATAL = new Set(["phase-payload", "bankrupt-actor", "no-actor", "auction-empty", "threw"]);

/** Buildings standing on the board, counted the way the bank counts them. */
function buildingsOnBoard(s: GameState): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (let pos = 0; pos < BOARD.length; pos++) {
    const n = (s.tiles[pos] as TileState).houses;
    if (n === 5) hotels += 1;
    else houses += n;
  }
  return { houses, hotels };
}

function checkInvariants(s: GameState, jailCardsSpent: number, push: (kind: string, detail: string) => void): void {
  // --- bank stock ---------------------------------------------------------
  const { houses, hotels } = buildingsOnBoard(s);
  if (s.houseStock !== HOUSE_STOCK_MAX - houses) {
    push("stock-houses", `houseStock=${s.houseStock} but ${houses} houses on board (expected ${HOUSE_STOCK_MAX - houses})`);
  }
  if (s.hotelStock !== HOTEL_STOCK_MAX - hotels) {
    push("stock-hotels", `hotelStock=${s.hotelStock} but ${hotels} hotels on board (expected ${HOTEL_STOCK_MAX - hotels})`);
  }

  // --- players ------------------------------------------------------------
  for (const p of s.players) {
    if (!Number.isInteger(p.money)) push("money-not-integer", `player ${p.id} money=${p.money}`);
    if (p.money < 0) push("money-negative", `player ${p.id} money=${p.money} bankrupt=${p.bankrupt}`);
    if (p.position < 0 || p.position > 39) push("position", `player ${p.id} position=${p.position}`);
    if (p.inJail && p.position !== 10) push("jail-position", `player ${p.id} inJail at ${p.position}`);
    if (p.inJail && p.bankrupt) push("jail-bankrupt", `player ${p.id}`);
    if (p.jailAttempts < 0 || p.jailAttempts > 3) push("jail-attempts", `player ${p.id} attempts=${p.jailAttempts}`);
    if (p.bankrupt && ownedPositions(s, p.id).length > 0) push("bankrupt-owns", `player ${p.id}`);
    if (p.bankrupt && p.money !== 0) push("bankrupt-money", `player ${p.id} money=${p.money}`);
  }

  // --- tiles --------------------------------------------------------------
  for (let pos = 0; pos < BOARD.length; pos++) {
    const tile = tileAt(pos);
    const st = s.tiles[pos] as TileState;
    const owned = tile.kind === "street" || tile.kind === "station" || tile.kind === "utility";
    if (st.owner !== null && !owned) push("owner-unownable", `${tile.name} (${pos}) owned by ${st.owner}`);
    if (st.owner !== null && s.players[st.owner]?.bankrupt) {
      push("owner-bankrupt", `${tile.name} (${pos}) owned by bankrupt ${st.owner}`);
    }
    if (st.houses > 0 && tile.kind !== "street") push("houses-non-street", `${tile.name} has ${st.houses}`);
    if (st.houses > 5 || st.houses < 0) push("houses-range", `${tile.name} houses=${st.houses}`);
    if (st.houses > 0 && st.owner === null) push("houses-unowned", `${tile.name} houses=${st.houses}`);
    if (st.houses > 0 && st.mortgaged) push("houses-mortgaged", `${tile.name} houses=${st.houses}`);
    if (st.mortgaged && st.owner === null) push("mortgaged-unowned", `${tile.name}`);
  }

  // --- even building ------------------------------------------------------
  for (const [group, members] of Object.entries(GROUP_MEMBERS)) {
    const counts = members.map((m) => (s.tiles[m] as TileState).houses);
    if (Math.max(...counts) - Math.min(...counts) > 1) {
      push("uneven-building", `${group}: ${counts.join("/")}`);
    }
    if (Math.max(...counts) > 0) {
      const owners = new Set(members.map((m) => (s.tiles[m] as TileState).owner));
      if (owners.size !== 1 || owners.has(null)) push("built-split-group", `${group} owners=${[...owners].join(",")}`);
      if (members.some((m) => (s.tiles[m] as TileState).mortgaged)) push("built-on-mortgaged-group", group);
    }
  }

  // --- phase / payload coherence -----------------------------------------
  const expectNull = (name: string, value: unknown, phase: string) => {
    if (s.phase === phase ? value === null : value !== null) {
      push("phase-payload", `phase=${s.phase} ${name}=${JSON.stringify(value)}`);
    }
  };
  expectNull("buyTile", s.buyTile, "buy-decision");
  expectNull("auction", s.auction, "auction");
  expectNull("debt", s.debt, "debt");
  expectNull("card", s.card, "card");
  if (s.phase === "resolving") push("phase-resolving", "resolving is an internal phase and must never be observable");

  // --- auction ------------------------------------------------------------
  if (s.auction) {
    if (s.auction.order.length === 0) push("auction-empty", `pos=${s.auction.pos}`);
    if (s.auction.order.some((id) => s.players[id]?.bankrupt)) push("auction-bankrupt-bidder", `${s.auction.order}`);
    if (s.auction.highBidder !== null && s.auction.highBid > (s.players[s.auction.highBidder] as Player).money) {
      push("auction-overbid", `bid=${s.auction.highBid} money=${(s.players[s.auction.highBidder] as Player).money}`);
    }
  }

  // --- turn / winner ------------------------------------------------------
  const live = s.players.filter((p) => !p.bankrupt);
  if (s.phase !== "game-over") {
    if (live.length <= 1 && s.auction === null && s.pendingAuctions.length === 0) {
      push("last-player-standing", `phase=${s.phase} live=${live.length}`);
    }
    const actor = actorFor(s);
    if (actor !== null && (s.players[actor] as Player).bankrupt) {
      push("bankrupt-actor", `phase=${s.phase} actor=${actor}`);
    }
  } else if (live.length === 1 && s.winner !== (live[0] as Player).id) {
    push("wrong-winner", `winner=${s.winner} live=${(live[0] as Player).id}`);
  }

  // --- decks --------------------------------------------------------------
  const total =
    s.decks.chance.length +
    s.decks.chest.length +
    s.discards.chance.length +
    s.discards.chest.length +
    s.players.reduce((n, p) => n + p.getOutCards, 0) +
    (s.card ? 1 : 0) +
    jailCardsSpent;
  const expected = DECK_IDS.chance.length + DECK_IDS.chest.length;
  if (total !== expected) push("deck-conservation", `${total} cards accounted for, expected ${expected}`);
  const ids = [...s.decks.chance, ...s.decks.chest, ...s.discards.chance, ...s.discards.chest];
  if (new Set(ids).size !== ids.length) push("deck-duplicate", "a card id appears twice");
  if (ids.some((id) => !CARDS_BY_ID[id])) push("deck-unknown-card", "unknown card id in a pile");

  // --- trades -------------------------------------------------------------
  if (s.pendingTrade) {
    const { from, offer } = s.pendingTrade;
    if (s.players[from]?.bankrupt || s.players[offer.to]?.bankrupt) push("trade-bankrupt", `${from}→${offer.to}`);
    if (from === offer.to) push("trade-self", `${from}`);
  }
}

// ---------------------------------------------------------------------- bots

function bestUnmortgage(s: GameState, p: Player, prof: Profile): Action | null {
  for (const pos of ownedPositions(s, p.id)) {
    if (canUnmortgage(s, p, pos) === null && p.money - unmortgageCost(pos) >= prof.reserve) {
      return { t: "unmortgage", pos };
    }
  }
  return null;
}

function bestBuild(s: GameState, p: Player, prof: Profile): Action | null {
  if (!prof.builds) return null;
  for (let pos = 0; pos < BOARD.length; pos++) {
    if (canBuildOn(s, p, pos) === null && p.money - (tileAt(pos).houseCost ?? 0) >= prof.reserve) {
      return { t: "build", pos };
    }
  }
  return null;
}

/** Sell buildings first, then mortgage — the order a player would choose. */
function raiseFunds(s: GameState, p: Player, need: number): Action | null {
  if (p.money >= need) return null;
  for (const pos of ownedPositions(s, p.id)) {
    if (canSellHouseOn(s, p, pos) === null) return { t: "sell-house", pos };
  }
  for (const pos of ownedPositions(s, p.id)) {
    if (canMortgage(s, p, pos) === null) return { t: "mortgage", pos };
  }
  return null;
}

/** A property that would complete one of this player's colour groups. */
function findCompletion(s: GameState, p: Player): { pos: number; owner: number } | null {
  for (const members of Object.values(GROUP_MEMBERS)) {
    const mine = members.filter((m) => (s.tiles[m] as TileState).owner === p.id).length;
    if (mine !== members.length - 1) continue;
    const missing = members.find((m) => (s.tiles[m] as TileState).owner !== p.id);
    if (missing === undefined) continue;
    const owner = (s.tiles[missing] as TileState).owner;
    if (owner === null || (s.players[owner] as Player).bankrupt) continue;
    if ((s.tiles[missing] as TileState).houses > 0) continue;
    return { pos: missing, owner };
  }
  return null;
}

/**
 * Answers an offer lying on the table.
 *
 * The engine refuses the dice until somebody has, so this is not optional —
 * and it is what a hot-seat device does anyway: the person being asked is
 * standing right there, and the screen is turned towards them.
 */
function answerTrade(pending: PendingTrade, rng: () => number): Action {
  if (rng() < 0.15) return { t: "withdraw-trade" };
  const offer = pending.offer;
  const gained = offer.giveMoney + offer.giveProps.reduce((n, pos) => n + (tileAt(pos).price ?? 0), 0);
  const lost = offer.takeMoney + offer.takeProps.reduce((n, pos) => n + (tileAt(pos).price ?? 0) * 2, 0);
  return gained >= lost ? { t: "accept-trade" } : { t: "reject-trade" };
}

function proposeTrade(s: GameState, p: Player, prof: Profile, rng: () => number): Action | null {
  if (!prof.trades || rng() < 0.7) return null;
  const completion = findCompletion(s, p);
  if (!completion) return null;
  const price = tileAt(completion.pos).price ?? 0;
  const give = Math.min(p.money - prof.reserve, Math.floor(price * 2.5));
  if (give < price * 2 || give <= 0) return null;
  return {
    t: "offer-trade",
    offer: { to: completion.owner, giveMoney: give, giveProps: [], takeMoney: 0, takeProps: [completion.pos] },
  };
}

function botAction(s: GameState, profiles: Profile[], rng: () => number): Action {
  const actorId = actorFor(s) as number;
  const actor = s.players[actorId] as Player;
  const prof = profiles[actorId] as Profile;

  // Nothing else may happen while an offer waits, so it comes first. A
  // pending offer can only exist at rest: making one needs turn-start or
  // post-roll, and the dice are refused until it is answered.
  if (s.pendingTrade && (s.phase === "turn-start" || s.phase === "post-roll")) {
    return answerTrade(s.pendingTrade, rng);
  }

  switch (s.phase) {
    case "auction": {
      const a = s.auction as NonNullable<GameState["auction"]>;
      const ceiling = Math.floor((tileAt(a.pos).price ?? 0) * prof.bidCeiling);
      const bid = a.highBid + (rng() < 0.3 ? 10 : 20);
      return bid <= actor.money && bid <= ceiling ? { t: "bid", amount: bid } : { t: "auction-pass" };
    }
    case "card":
      return { t: "ack-card" };
    case "buy-decision": {
      const price = tileAt(s.buyTile as number).price ?? 0;
      if (actor.money - price >= prof.reserve) return { t: "buy" };
      // Short of cash but keen: liquidate rather than hand it to the table.
      if (prof.reserve === 0) {
        const raise = raiseFunds(s, actor, price);
        if (raise) return raise;
      }
      return { t: "decline" };
    }
    case "debt": {
      const debt = s.debt as NonNullable<GameState["debt"]>;
      if (prof.liquidates) {
        const raise = raiseFunds(s, actor, debt.amount);
        if (raise) return raise;
      }
      return actor.money >= debt.amount ? { t: "pay-debt" } : { t: "declare-bankruptcy" };
    }
    case "turn-start": {
      const trade = proposeTrade(s, actor, prof, rng);
      if (trade) return trade;
      if (actor.inJail) {
        if (actor.getOutCards > 0) return { t: "use-jail-card" };
        if (prof.buysOutOfJail && actor.money >= JAIL_FINE + prof.reserve) return { t: "pay-fine" };
      }
      return bestUnmortgage(s, actor, prof) ?? bestBuild(s, actor, prof) ?? { t: "roll" };
    }
    case "post-roll": {
      const trade = proposeTrade(s, actor, prof, rng);
      if (trade) return trade;
      return bestUnmortgage(s, actor, prof) ?? bestBuild(s, actor, prof) ?? { t: "end-turn" };
    }
    case "game-over":
    case "resolving":
      return { t: "end-turn" };
  }
}

// ----------------------------------------------------------------- game loop

interface Run {
  seed: number;
  players: number;
  finished: boolean;
  turns: number;
  actions: number;
  winner: number | null;
  violations: Violation[];
  /** Stopped because the board became unplayable, not because time ran out. */
  stuck: boolean;
  /** Why a capped game was still running, for telling policy from engine. */
  cap: { live: number; monopolies: number; houseStock: number; totalMoney: number } | null;
}

/** Colour groups held whole by one solvent player — the engine of an endgame. */
function monopolyCount(s: GameState): number {
  let n = 0;
  for (const members of Object.values(GROUP_MEMBERS)) {
    const owner = (s.tiles[members[0] as number] as TileState).owner;
    if (owner === null || (s.players[owner] as Player).bankrupt) continue;
    if (members.every((m) => (s.tiles[m] as TileState).owner === owner)) n += 1;
  }
  return n;
}

function runGame(seed: number, numPlayers: number): Run {
  const rng = makeRng(seed ^ 0x5bf03635);
  const profiles = Array.from({ length: numPlayers }, (_, i) => PROFILES[(seed + i) % PROFILES.length] as Profile);
  const defs = Array.from({ length: numPlayers }, (_, i) => ({ name: `Bot${i}-${(profiles[i] as Profile).name}`, pawn: i }));
  const trace = Boolean(process.env.TRACE);

  let s = createGame(defs, seed);
  const violations: Violation[] = [];
  const seen = new Set<string>();
  let jailCardsSpent = 0;
  let actions = 0;
  let lastTurn = s.turnCount;
  let sameTurnActions = 0;

  let stuck = false;
  const push = (kind: string, detail: string) => {
    if (FATAL.has(kind)) stuck = true;
    const key = `${kind}|${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ kind, detail, turn: s.turnCount, phase: s.phase });
  };

  while (s.phase !== "game-over" && s.turnCount <= MAX_TURNS && !stuck) {
    actions += 1;
    if (actions > 400_000) {
      push("action-budget", "400k actions without a winner — stuck loop");
      break;
    }
    if (s.turnCount === lastTurn) {
      sameTurnActions += 1;
      if (sameTurnActions > 4000) {
        push("turn-livelock", `${sameTurnActions} actions inside turn ${s.turnCount} (phase=${s.phase})`);
        break;
      }
    } else {
      if (s.turnCount < lastTurn) push("turn-regress", `${lastTurn} → ${s.turnCount}`);
      lastTurn = s.turnCount;
      sameTurnActions = 0;
    }

    const actorId = actorFor(s);
    if (actorId === null) {
      push("no-actor", `phase=${s.phase} but game not over`);
      break;
    }
    if ((s.players[actorId] as Player).bankrupt) {
      push("bankrupt-actor", `engine asked bankrupt ${actorId} to act in phase=${s.phase}`);
      break;
    }

    const action = botAction(s, profiles, rng);
    if (trace) {
      console.log(`t${s.turnCount} ph=${s.phase} actor=${actorId} money=${(s.players[actorId] as Player).money} → ${action.t}`);
    }
    let events: GameEvent[];
    try {
      const result = applyAction(s, action);
      s = result.state;
      events = result.events;
    } catch (e) {
      push("threw", `${action.t} threw "${(e as Error).message}" in phase=${s.phase}`);
      break;
    }
    for (const ev of events) {
      if (ev.t === "jail-out" && ev.reason === "card") jailCardsSpent += 1;
    }
    checkInvariants(s, jailCardsSpent, push);
  }

  const capped = s.phase !== "game-over";
  return {
    seed,
    players: numPlayers,
    finished: !capped,
    stuck,
    turns: s.turnCount,
    actions,
    winner: s.winner,
    violations,
    cap: capped
      ? {
          live: s.players.filter((p) => !p.bankrupt).length,
          monopolies: monopolyCount(s),
          houseStock: s.houseStock,
          totalMoney: s.players.reduce((n, p) => n + p.money, 0),
        }
      : null,
  };
}

// -------------------------------------------------------------------- report

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
}

function main(): void {
  if (process.env.SEED_ONLY) {
    const r = runGame(Number(process.env.SEED_ONLY), Number(process.env.SEED_PLAYERS ?? 4));
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  const byKind = new Map<string, { count: number; sample: Run & { first: Violation } }>();
  let grandTotal = 0;
  let grandFinished = 0;

  for (const numPlayers of PLAYER_COUNTS) {
    const runs: Run[] = [];
    for (let i = 0; i < GAMES; i++) runs.push(runGame(i * 7919 + numPlayers * 104729, numPlayers));
    const finished = runs.filter((r) => r.finished);
    const turns = finished.map((r) => r.turns).sort((a, b) => a - b);
    const dirty = runs.filter((r) => r.violations.length > 0);
    grandTotal += runs.length;
    grandFinished += finished.length;

    const stuckRuns = runs.filter((r) => r.stuck);
    const caps = runs.filter((r) => !r.stuck).map((r) => r.cap).filter((c): c is NonNullable<Run["cap"]> => c !== null);
    const avg = (pick: (c: NonNullable<Run["cap"]>) => number) =>
      caps.length === 0 ? 0 : Math.round(caps.reduce((n, c) => n + pick(c), 0) / caps.length);
    console.log(
      `${numPlayers}p × ${GAMES}: finished ${finished.length}/${runs.length}` +
        ` (${((finished.length / runs.length) * 100).toFixed(1)}%)` +
        ` | turns med=${quantile(turns, 0.5)} p90=${quantile(turns, 0.9)} max=${turns[turns.length - 1] ?? 0}` +
        ` | unplayable=${stuckRuns.length} | games with violations=${dirty.length}`,
    );
    if (caps.length > 0) {
      console.log(
        `      capped ${caps.length}: avg live=${avg((c) => c.live)} monopolies=${avg((c) => c.monopolies)}` +
          ` houseStock=${avg((c) => c.houseStock)} cash-in-play=${avg((c) => c.totalMoney)}`,
      );
    }
    for (const r of dirty) {
      for (const v of r.violations) {
        const entry = byKind.get(v.kind);
        if (entry) entry.count += 1;
        else byKind.set(v.kind, { count: 1, sample: { ...r, first: v } });
      }
    }
  }

  console.log(`\ntotal: ${grandFinished}/${grandTotal} games reached a winner`);
  if (byKind.size === 0) {
    console.log("no invariant violations");
    return;
  }
  console.log(`\nviolations by kind (${byKind.size} distinct):`);
  for (const [kind, { count, sample }] of [...byKind.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${kind} ×${count}`);
    console.log(`    e.g. seed=${sample.seed} players=${sample.players} turn=${sample.first.turn} phase=${sample.first.phase}`);
    console.log(`         ${sample.first.detail}`);
  }
}

main();
