import { createGame, applyAction, JAIL_FINE } from "../src/game/engine";
import type { Action, GameState, Player } from "../src/game/types";
import { BOARD, GROUP_MEMBERS, tileAt } from "../src/game/data/board";
import {
  actorFor,
  canBuildOn,
  canMortgage,
  canSellHouseOn,
  canUnmortgage,
  ownedPositions,
  unmortgageCost,
} from "../src/game/selectors";

const RESERVE = 120;
const MAX_TURNS = Number(process.env.MAX_TURNS ?? 1500);
const GAMES = Number(process.env.GAMES ?? 200);

interface Run {
  seed: number;
  players: number;
  finished: boolean;
  turns: number;
  winner: number | null;
  violations: string[];
  state: GameState;
}

function current(s: GameState): Player {
  return s.players[s.current] as Player;
}

function tryBuild(s: GameState): Action | null {
  const p = current(s);
  for (const pos of ownedPositions(s, p.id)) {
    if (canUnmortgage(s, p, pos) === null && p.money - unmortgageCost(pos) >= RESERVE) {
      return { t: "unmortgage", pos };
    }
  }
  for (let pos = 0; pos < BOARD.length; pos++) {
    if (canBuildOn(s, p, pos) === null) {
      const cost = tileAt(pos).houseCost ?? 0;
      if (p.money - cost >= RESERVE) return { t: "build", pos };
    }
  }
  return null;
}

function raiseFunds(s: GameState): Action | null {
  const p = current(s);
  const debt = s.debt;
  if (!debt || p.money >= debt.amount) return null;
  for (const pos of ownedPositions(s, p.id)) {
    if (canSellHouseOn(s, p, pos) === null) return { t: "sell-house", pos };
  }
  for (const pos of ownedPositions(s, p.id)) {
    if (canMortgage(s, p, pos) === null) return { t: "mortgage", pos };
  }
  return null;
}

function groupTotalPrice(positions: number[]): number {
  return positions.reduce((sum, pos) => sum + (tileAt(pos).price ?? 0), 0);
}

function findCompletion(s: GameState, p: Player): { pos: number; owner: number } | null {
  for (const members of Object.values(GROUP_MEMBERS)) {
    const mine = members.filter((m) => s.tiles[m]?.owner === p.id).length;
    if (mine !== members.length - 1) continue;
    const missing = members.find((m) => s.tiles[m]?.owner !== p.id && s.tiles[m]?.owner !== null);
    const owner = missing !== undefined ? ((s.tiles[missing] as { owner: number | null }).owner as number | null) : null;
    if (missing !== undefined && owner !== null && !(s.players[owner] as Player).bankrupt) {
      return { pos: missing, owner };
    }
  }
  return null;
}

function tradeAction(s: GameState): Action | null {
  const pending = s.pendingTrade;
  if (pending) {
    const offer = pending.offer;
    const net =
      offer.giveMoney + groupTotalPrice(offer.giveProps) - offer.takeMoney - 2 * groupTotalPrice(offer.takeProps);
    return net >= 0 ? { t: "accept-trade" } : { t: "reject-trade" };
  }
  const p = current(s);
  const other = s.players.find((o) => o.id !== p.id && !o.bankrupt);
  if (!other) return null;
  const completion = findCompletion(s, p);
  if (!completion) return null;
  const price = tileAt(completion.pos).price ?? 0;
  const give = Math.min(p.money - RESERVE, Math.floor(price * 2.5));
  if (give < price * 2) return null;
  return {
    t: "offer-trade",
    offer: { to: completion.owner, giveMoney: give, giveProps: [], takeMoney: 0, takeProps: [completion.pos] },
  };
}

function botAction(s: GameState): Action {
  const p = current(s);
  switch (s.phase) {
    case "turn-start": {
      const raise = raiseFunds(s);
      if (raise) return raise;
      const trade = tradeAction(s);
      if (trade) return trade;
      if (p.inJail) {
        if (p.getOutCards > 0) return { t: "use-jail-card" };
        if (p.money >= JAIL_FINE + RESERVE) return { t: "pay-fine" };
      }
      return tryBuild(s) ?? { t: "roll" };
    }
    case "post-roll":
      return raiseFunds(s) ?? (s.pendingTrade ? tradeAction(s) : null) ?? tryBuild(s) ?? { t: "end-turn" };
    case "card":
      return { t: "ack-card" };
    case "buy-decision": {
      const pos = s.buyTile as number;
      const price = tileAt(pos).price ?? 0;
      return p.money - price >= RESERVE ? { t: "buy" } : { t: "decline" };
    }
    case "auction": {
      const a = s.auction as NonNullable<GameState["auction"]>;
      const bidder = s.players[a.order[0] as number] as Player;
      const price = tileAt(a.pos).price ?? 0;
      const bid = a.highBid + 20;
      return bid <= bidder.money && bid <= price ? { t: "bid", amount: bid } : { t: "auction-pass" };
    }
    case "debt": {
      if (!s.debt) {
        throw new Error(
          `debt-phase with null debt: turn=${s.turnCount} current=${s.current} lastRoll=${JSON.stringify(s.lastRoll)}` +
            ` log-tail=${JSON.stringify(s.log.slice(-6))}`,
        );
      }
      const raise = raiseFunds(s);
      if (raise) return raise;
      const debt = s.debt as NonNullable<GameState["debt"]>;
      return p.money >= debt.amount ? { t: "pay-debt" } : { t: "declare-bankruptcy" };
    }
    // `resolving` is internal and never observable between two actions, but
    // `PhaseKind` includes it and the project compiles with `strict`: without
    // a branch here the function has a path that returns nothing.
    case "resolving":
    case "game-over":
      return { t: "end-turn" };
  }
}

function checkInvariants(s: GameState, violations: string[]): void {
  for (const p of s.players) {
    if (!Number.isFinite(p.money)) violations.push(`money=${p.money} for player ${p.id}`);
    if (!p.bankrupt && p.money < 0) violations.push(`negative money ${p.money} for live player ${p.id}`);
    if (p.bankrupt && ownedPositions(s, p.id).length > 0) {
      violations.push(`bankrupt player ${p.id} still owns tiles`);
    }
  }
  if (s.houseStock < 0 || s.houseStock > 32) violations.push(`houseStock=${s.houseStock}`);
  if (s.hotelStock < 0 || s.hotelStock > 12) violations.push(`hotelStock=${s.hotelStock}`);
  const live = s.players.filter((p) => !p.bankrupt).length;
  if (live <= 1 && s.phase !== "game-over" && s.pendingAuctions.length === 0 && s.auction === null) {
    violations.push(`last player standing but phase=${s.phase}`);
  }
}

function runGame(seed: number, numPlayers: number): Run {
  const defs = Array.from({ length: numPlayers }, (_, i) => ({ name: `Joueur ${i + 1}`, pawn: i }));
  let s = createGame(defs, seed);
  const trace = Boolean(process.env.TRACE);
  const violations: string[] = [];
  let actions = 0;
  while (s.phase !== "game-over" && s.turnCount <= MAX_TURNS) {
    actions += 1;
    if (actions > 500_000) {
      violations.push("action budget exhausted (stuck loop?)");
      break;
    }
    const actorId = actorFor(s);
    if (actorId === null) break;
    const actor = s.players[actorId] as Player;
    if (actor.bankrupt) {
      violations.push(`engine asked bankrupt player ${actorId} to act (phase=${s.phase}, turn=${s.turnCount})`);
      break;
    }
    const action = botAction(s);
    if (trace) {
      console.log(`t${s.turnCount} ph=${s.phase} actor=${actorId} money=${actor.money} act=${action.t}`);
    }
    let result;
    try {
      result = applyAction(s, action);
    } catch (e) {
      violations.push(`applyAction(${action.t}) threw: ${(e as Error).message} (phase=${s.phase}, turn=${s.turnCount})`);
      break;
    }
    s = result.state;
    if (s.phase === "debt" && !s.debt) {
      violations.push(`phase="debt" with debt=null after ${action.t} (turn ${s.turnCount})`);
      break;
    }
    checkInvariants(s, violations);
  }
  return {
    seed,
    players: numPlayers,
    finished: s.phase === "game-over",
    turns: s.turnCount,
    winner: s.winner,
    violations: violations.slice(0, 3),
    state: s,
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
}

function report(runs: Run[]): void {
  const done = runs.filter((r) => r.finished);
  const bad = runs.filter((r) => r.violations.length > 0);
  const turns = done.map((r) => r.turns).sort((a, b) => a - b);
  const capped = runs.filter((r) => !r.finished && r.violations.length === 0);
  console.log(
    `  ${done.length}/${runs.length} finished (${((done.length / runs.length) * 100).toFixed(1)}%)` +
      ` | turns median=${quantile(turns, 0.5)} p90=${quantile(turns, 0.9)} max=${turns[turns.length - 1] ?? 0}` +
      ` | hit-turn-cap=${capped.length} | violations=${bad.length}`,
  );
  for (const r of bad.slice(0, 5)) {
    console.log(`    seed=${r.seed} turn=${r.turns}: ${r.violations[0]}`);
  }
}

function dumpCapped(r: Run): void {
  const s = r.state;
  console.log(`  capped seed=${r.seed} turn=${r.turns} phase=${s.phase}`);
  for (const p of s.players) {
    const props = ownedPositions(s, p.id);
    console.log(
      `    ${p.name}: money=${p.money} props=${props.map((pos) => `${tileAt(pos).name}${(s.tiles[pos] as { houses: number }).houses ? `(${(s.tiles[pos] as { houses: number }).houses})` : ""}`).join(", ")}`,
    );
  }
  console.log(`    houseStock=${s.houseStock} hotelStock=${s.hotelStock}`);
  console.log(`    log: ${s.log.slice(-8).join(" | ")}`);
}

if (process.env.SEED_ONLY) {
  const r = runGame(Number(process.env.SEED_ONLY), Number(process.env.SEED_PLAYERS ?? 2));
  console.log(`finished=${r.finished} turns=${r.turns} winner=${r.winner} violations=${r.violations.length}`);
  if (!r.finished) dumpCapped(r);
} else {
  for (const numPlayers of [2, 3, 4, 6, 8]) {
    console.log(`${numPlayers} players, ${GAMES} games:`);
    const runs: Run[] = [];
    for (let i = 0; i < GAMES; i++) {
      const r = runGame(i * 1_000_003 + numPlayers, numPlayers);
      runs.push(r);
      if (process.env.DEBUG_CAP && !r.finished && r.violations.length === 0) dumpCapped(r);
    }
    report(runs);
  }
}
