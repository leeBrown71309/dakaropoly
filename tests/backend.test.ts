import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyAction, createGame } from "../src/game/engine";
import { actorFor, standingsOf } from "../src/game/selectors";
import type { Action, GameState } from "../src/game/types";
import { seatOf, type Seat } from "../src/net/room";
import {
  finalBoardOf,
  mySeat,
  nameOf,
  placeOf,
  takeoversIn,
  wonBy,
  type History,
  type HistoryGame,
  type HistorySeat,
} from "../src/net/history";

/**
 * The accounts and the history of games, end to end, with bots.
 *
 * The real `supabase/schema.sql` runs in PGlite — Postgres inside the test
 * process — behind a stand-in for what Supabase provides: an `auth.users`
 * table and an `auth.uid()` that answers whoever the test says is calling.
 * That is all Google ever contributes: after the sign-in, an account is an id
 * in `auth.users`, and every function here sees nothing else. So the bots are
 * accounts in every sense the backend can tell, without an e-mail address.
 *
 * Games are played to the end by the real engine, one legal action at a
 * time, and every action's board is written through `advance_room` by the
 * device holding the chair — the path a real table takes. The history is then
 * read back with `get_my_games` and the same helpers the profile screen uses.
 */

const SCHEMA = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

let db: PGlite;

/** Runs a statement as the given identity, the way a signed-in device would. */
async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query(`select set_config('request.uid', $1, false)`, [uid]);
  return (await db.query<T>(sql, params)).rows;
}

async function refusal(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await as(uid, sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

let ids = 0;
/** A fresh identity: an account signed in with "Google", or an anonymous guest. */
async function person(kind: "account" | "guest"): Promise<string> {
  ids += 1;
  const id = `00000000-0000-4000-8000-${String(ids).padStart(12, "0")}`;
  await db.query(`insert into auth.users (id, is_anonymous) values ($1, $2)`, [id, kind === "guest"]);
  return id;
}

async function account(pseudo: string, avatar: string | null = null): Promise<string> {
  const id = await person("account");
  await as(id, `select save_profile($1, $2)`, [pseudo, avatar]);
  return id;
}

interface RawSeat {
  client_id: string;
  seat: number | null;
  name: string;
  pawn: number | null;
  avatar: string | null;
  absent: boolean;
}
interface RawRoom {
  status: string;
  version: number;
  seat_order: string[];
  state: GameState | null;
  seats: RawSeat[];
}

async function room(code: string, uid: string): Promise<RawRoom | null> {
  const [row] = await as<{ r: RawRoom | null }>(uid, `select get_room($1) r`, [code]);
  return row?.r ?? null;
}

const toSeats = (r: RawRoom): Seat[] =>
  r.seats.map((s) => ({ clientId: s.client_id, seat: s.seat, name: s.name, pawn: s.pawn, avatar: s.avatar, absent: s.absent }));

async function history(uid: string, limit = 20): Promise<History> {
  const [row] = await as<{ h: { games: RawGame[]; people: History["people"] } }>(uid, `select get_my_games($1) h`, [limit]);
  const h = row?.h ?? { games: [], people: {} };
  return { games: h.games.map(toGame), people: h.people };
}

interface RawGame {
  id: string;
  status: HistoryGame["status"];
  started_at: string;
  ended_at: string | null;
  turn_count: number;
  winner: number | null;
  final: GameState | null;
  seats: { seat: number; account_id: string | null; name: string; pawn: number; from_turn: number }[];
}
const toGame = (r: RawGame): HistoryGame => ({
  id: r.id,
  status: r.status,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  turnCount: r.turn_count,
  winner: r.winner,
  final: r.final,
  seats: r.seats.map(
    (s): HistorySeat => ({ seat: s.seat, accountId: s.account_id, name: s.name, pawn: s.pawn, fromTurn: s.from_turn }),
  ),
});

/* ------------------------------------------------------------------ bots */

/** Deterministic dice for the bots' choices; the engine owns the game's own. */
function chooser(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** What a bot tries in each phase, best idea first; the engine refuses the rest. */
function ideas(s: GameState, rand: () => number): Action[] {
  const me = s.players[actorFor(s) ?? 0];
  switch (s.phase) {
    case "turn-start":
      return me?.inJail ? [{ t: "use-jail-card" }, { t: "pay-fine" }, { t: "roll" }] : [{ t: "roll" }];
    case "buy-decision":
      return rand() < 0.8 ? [{ t: "buy" }, { t: "decline" }] : [{ t: "decline" }];
    case "auction":
      return rand() < 0.3 && s.auction
        ? [{ t: "bid", amount: s.auction.highBid + 10 }, { t: "auction-pass" }]
        : [{ t: "auction-pass" }];
    case "card":
      return [{ t: "ack-card" }];
    case "debt":
      return [{ t: "pay-debt" }, { t: "declare-bankruptcy" }];
    default:
      return [{ t: "end-turn" }];
  }
}

/** A table in play: the room code, who holds which chair, and the board. */
interface Table {
  code: string;
  host: string;
  order: string[];
  state: GameState;
  version: number;
}

/**
 * Opens a room the way the lobby does: the host creates it, everybody claims
 * a pawn, and the host kicks off with the seating in pawn order. The pawns
 * are handed out of order on purpose — a table whose pawns were not 0, 1, 2…
 * is exactly what used to seat every player as a spectator.
 */
async function openTable(code: string, players: { id: string; name: string; pawn: number }[]): Promise<Table> {
  const host = players[0]?.id as string;
  await as(host, `select create_room($1)`, [code]);
  for (const p of players) await as(p.id, `select claim_seat($1, $2, $3, $4::smallint)`, [code, p.id, p.name, p.pawn]);
  const lobby = (await room(code, host)) as RawRoom;
  const seated = toSeats(lobby)
    .filter((s) => s.seat !== null)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const state = createGame(
    seated.map((s) => ({ name: s.name, pawn: s.pawn ?? 0 })),
    code.length * 7919,
  );
  const order = seated.map((s) => s.clientId);
  await as(host, `select open_room($1, 1, $2::jsonb, $3::jsonb)`, [code, JSON.stringify(state), JSON.stringify(order)]);
  return { code, host, order, state, version: 1 };
}

/** One action by whoever holds the acting chair, written back as their device would. */
async function play(t: Table, action: Action): Promise<void> {
  const res = applyAction(t.state, action);
  const actor = action.t === "resign" ? action.playerId : (actorFor(t.state) ?? 0);
  const by = t.order[actor] as string;
  const [row] = await as<{ ok: boolean }>(by, `select advance_room($1, $2::jsonb, $3) ok`, [
    t.code,
    JSON.stringify(res.state),
    t.version,
  ]);
  expect(row?.ok, `snapshot refused at version ${t.version}`).toBe(true);
  t.state = res.state;
  t.version += 1;
}

/** Plays one legal action chosen by the bot to move. */
async function step(t: Table, rand: () => number): Promise<void> {
  for (const action of ideas(t.state, rand)) {
    try {
      applyAction(t.state, action);
    } catch {
      continue;
    }
    await play(t, action);
    return;
  }
  throw new Error(`no legal move in phase ${t.state.phase}`);
}

/**
 * Plays until the game ends, or until `stopAt` turns. Past `resignFrom`, a
 * player walks out at each turn start, so every game finishes in a test's
 * time — resigning is a real action, and it is how most evenings end anyway.
 */
async function playOut(t: Table, rand: () => number, { stopAt = Infinity, resignFrom = 30 } = {}): Promise<void> {
  for (let guard = 0; guard < 20_000; guard++) {
    if (t.state.phase === "game-over" || t.state.turnCount >= stopAt) return;
    if (t.state.phase === "turn-start" && t.state.turnCount >= resignFrom) {
      const leaver = t.state.players.find((p) => !p.bankrupt && p.id !== t.state.current);
      if (leaver) {
        await play(t, { t: "resign", playerId: leaver.id });
        continue;
      }
    }
    await step(t, rand);
  }
  throw new Error("the game never ended");
}

/* ----------------------------------------------------------------- tests */

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  `);
  await db.exec(SCHEMA);
}, 60_000);

describe("profiles", () => {
  it("lets an account choose a pseudo, and refuses one already taken", async () => {
    await account("Moussa");
    const other = await person("account");
    expect(await refusal(other, `select save_profile('Moussa', null)`)).toMatch(/Ce pseudo existe déjà/);
    // Case is part of the pseudo.
    await as(other, `select save_profile('moussa', null)`);
    const [mine] = await as<{ p: { pseudo: string } }>(other, `select get_my_profile() p`);
    expect(mine?.p.pseudo).toBe("moussa");
  });

  it("gives a guest no profile to make", async () => {
    const guest = await person("guest");
    expect(await refusal(guest, `select save_profile('Invité', null)`)).toMatch(/Connectez-vous/);
  });

  it("answers availability while typing, the caller's own pseudo counting as free", async () => {
    const me = await account("Awa");
    const other = await person("account");
    const [free] = await as<{ v: boolean }>(me, `select pseudo_available('Awa') v`);
    const [taken] = await as<{ v: boolean }>(other, `select pseudo_available('Awa') v`);
    expect(free?.v).toBe(true);
    expect(taken?.v).toBe(false);
  });
});

describe("a full game between accounts and a guest", () => {
  let table: Table;
  let host: string;
  let awa: string;
  let guest: string;

  beforeAll(async () => {
    host = await account("Hôte", "data:image/webp;base64,SE9TVA==");
    awa = await account("Awa_2");
    guest = await person("guest");
    table = await openTable("FULL01", [
      { id: host, name: "tapé à la main", pawn: 5 },
      { id: guest, name: "Invité", pawn: 2 },
      { id: awa, name: "autre chose", pawn: 7 },
    ]);
  }, 60_000);

  it("seats every player in their own chair at kickoff, whatever pawns they chose", async () => {
    const r = (await room("FULL01", host)) as RawRoom;
    for (const id of [host, guest, awa]) {
      expect(seatOf(r.seat_order, toSeats(r), id)).toBe(r.seat_order.indexOf(id));
    }
  });

  it("sits accounts down under their pseudo and photo, and guests under the name they typed", async () => {
    const r = (await room("FULL01", host)) as RawRoom;
    const byId = (id: string) => r.seats.find((s) => s.client_id === id);
    expect(byId(host)?.name).toBe("Hôte");
    expect(byId(host)?.avatar).toBe("data:image/webp;base64,SE9TVA==");
    expect(byId(awa)?.name).toBe("Awa_2");
    expect(byId(guest)?.name).toBe("Invité");
    expect(table.state.players.map((p) => p.name)).toEqual(["Invité", "Hôte", "Awa_2"]);
  });

  it("plays to the end and files the game in each account's history", async () => {
    await playOut(table, chooser(1), { resignFrom: 90 });
    expect(table.state.phase).toBe("game-over");
    // A real evening's worth of play, not a game that ended at the first turn.
    expect(table.version).toBeGreaterThan(150);
    expect(table.state.players.some((p) => p.stats.purchases > 0)).toBe(true);

    for (const id of [host, awa]) {
      const h = await history(id);
      const game = h.games.find((g) => g.turnCount === table.state.turnCount && g.status === "finished");
      expect(game, "game missing from history").toBeDefined();
      const seat = mySeat(game as HistoryGame, id);
      expect(seat).toBe(table.order.indexOf(id));
      // The place on the dashboard is the place on the end-of-game screen.
      const standing = standingsOf(table.state).findIndex((p) => p.id === seat) + 1;
      expect(placeOf(game as HistoryGame, seat as number)).toBe(standing);
      expect(wonBy(game as HistoryGame, id)).toBe(table.state.winner === seat);
    }
    expect((await history(guest)).games).toHaveLength(0);
  }, 120_000);

  it("shows the photo of each account among the people, once", async () => {
    const h = await history(awa);
    expect(h.people[host]?.avatar).toBe("data:image/webp;base64,SE9TVA==");
    expect(h.people[awa]?.pseudo).toBe("Awa_2");
    expect(h.people[guest]).toBeUndefined();
  });
});

describe("a chair taken over during the game", () => {
  it("credits the game to both occupants, and the win to whoever finished in it", async () => {
    const fatou = await account("Fatou");
    const leaver = await account("Partant");
    const guest = await person("guest");
    const t = await openTable("TAKE01", [
      { id: guest, name: "Invité", pawn: 4 },
      { id: leaver, name: "x", pawn: 1 },
    ]);
    await playOut(t, chooser(2), { stopAt: 6 });

    // The account in chair 0 (pawn 1) goes quiet; Fatou takes it over.
    const seat = t.order.indexOf(leaver);
    await db.query(`update room_players set last_seen = now() - interval '2 minutes' where client_id = $1`, [leaver]);
    await as(fatou, `select resume_seat('TAKE01', $1::smallint)`, [seat]);
    t.order[seat] = fatou;
    // The device puts its pseudo on the board, as `adoptPseudo` does.
    await play(t, { t: "rename", playerId: seat, name: "Fatou" });
    const takenAt = t.state.turnCount;

    await playOut(t, chooser(3), { resignFrom: 12 });
    const game = (await history(fatou)).games[0] as HistoryGame;
    expect(game.status).toBe("finished");
    expect((await history(leaver)).games[0]?.id).toBe(game.id);

    const [takeover] = takeoversIn(game);
    expect(takeover?.from.accountId).toBe(leaver);
    expect(takeover?.to.accountId).toBe(fatou);
    expect(takeover?.to.fromTurn).toBe(takenAt);
    expect(wonBy(game, leaver)).toBe(false);
    expect(wonBy(game, fatou)).toBe(t.state.winner === seat);
    expect(finalBoardOf(game, {})?.players[seat]?.name).toBe("Fatou");
  }, 120_000);
});

describe("a room that expires before the end", () => {
  it("keeps the game as unfinished, ranked on the last board written", async () => {
    const a = await account("Tardif");
    const b = await account("Couche_tôt");
    const t = await openTable("GONE01", [
      { id: a, name: "a", pawn: 3 },
      { id: b, name: "b", pawn: 6 },
    ]);
    await playOut(t, chooser(4), { stopAt: 8 });

    // Everyone leaves for the evening: an hour of silence, then any device's heartbeat sweeps.
    await db.query(`update rooms set updated_at = now() - interval '1 hour' where code = 'GONE01'`);
    await db.query(`update room_players set last_seen = now() - interval '1 hour' where room_code = 'GONE01'`);
    await as(a, `select touch_seat('ELSEWHERE')`);
    expect(await room("GONE01", a)).toBeNull();

    const game = (await history(a)).games[0] as HistoryGame;
    expect(game.status).toBe("unfinished");
    expect(game.turnCount).toBe(t.state.turnCount);
    expect(wonBy(game, a) || wonBy(game, b)).toBe(false);
    expect(placeOf(game, t.order.indexOf(a))).not.toBeNull();
  }, 120_000);
});

describe("tables of guests", () => {
  it("keeps nothing of a game nobody with an account played", async () => {
    const g1 = await person("guest");
    const g2 = await person("guest");
    const [before] = await as<{ n: number }>(g1, `select count(*)::int n from games`);
    const t = await openTable("GUEST1", [
      { id: g1, name: "G1", pawn: 0 },
      { id: g2, name: "G2", pawn: 1 },
    ]);
    await playOut(t, chooser(5), { resignFrom: 3 });
    const [after] = await as<{ n: number }>(g1, `select count(*)::int n from games`);
    expect(after?.n).toBe(before?.n);
  }, 120_000);
});

describe("the dashboard", () => {
  it("lists the twenty most recent games, newest first", async () => {
    const me = await account("Assidu");
    const rival = await person("guest");
    for (let i = 0; i < 22; i++) {
      const t = await openTable(`LOT${String(i).padStart(3, "0")}`, [
        { id: me, name: "m", pawn: 0 },
        { id: rival, name: "r", pawn: 1 },
      ]);
      // Over as soon as it starts: the rival walks out on turn one.
      await play(t, { t: "resign", playerId: 1 });
      // Kept apart in time, so "newest" means something.
      await db.query(`update games set started_at = now() - make_interval(mins => $1) where room_code = $2`, [
        100 - i,
        t.code,
      ]);
    }
    const h = await history(me);
    expect(h.games).toHaveLength(20);
    expect(h.games.every((g, i, all) => i === 0 || (all[i - 1] as HistoryGame).startedAt >= g.startedAt)).toBe(true);
    expect(h.games.every((g) => wonBy(g, me))).toBe(true);
  }, 120_000);
});

describe("deleting an account", () => {
  it("removes the person and leaves the game with everybody else, under the name at the table", async () => {
    const stays = await account("Reste");
    const goes = await account("Part");
    const t = await openTable("DEL001", [
      { id: stays, name: "s", pawn: 0 },
      { id: goes, name: "p", pawn: 1 },
    ]);
    await play(t, { t: "resign", playerId: 0 });

    await as(goes, `select delete_account()`);
    const [left] = await as<{ n: number }>(stays, `select count(*)::int n from profiles where id = $1`, [goes]);
    expect(left?.n).toBe(0);

    const h = await history(stays);
    const game = h.games.find((g) => g.seats.some((s) => s.name === "Part")) as HistoryGame;
    expect(game).toBeDefined();
    const gone = game.seats.find((s) => s.name === "Part") as HistorySeat;
    expect(gone.accountId).toBeNull();
    expect(nameOf(gone, h.people)).toBe("Part");
    expect(h.people[goes]).toBeUndefined();
    // And the pseudo is free for somebody else.
    const [free] = await as<{ v: boolean }>(stays, `select pseudo_available('Part') v`);
    expect(free?.v).toBe(true);
  });
});

describe("what nobody may call", () => {
  it("keeps the functions that close a game out of reach", async () => {
    const rows = await as<{ proname: string; ok: boolean }>(
      await person("account"),
      `select p.proname, has_function_privilege('authenticated', p.oid, 'execute') ok
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('close_game', 'close_game_with_room')`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.ok)).toBe(true);
  });
});
