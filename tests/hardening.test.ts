import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../src/game/engine";
import type { GameState } from "../src/game/types";

/**
 * Regression tests for the hardening pass that preceded online play.
 *
 * Every case here is a defect that was reachable in the shipped hot-seat
 * game, not a hypothetical. Several of them only ever bite after a long
 * evening, which is exactly why they survived manual testing.
 */

function makeGame(playerCount = 2, seed = 7): GameState {
  return createGame(
    Array.from({ length: playerCount }, (_, i) => ({ name: `J${i}`, pawn: i })),
    seed,
  );
}

function place(s: GameState, id: number, pos: number): GameState {
  return { ...s, players: s.players.map((pl, i) => (i === id ? { ...pl, position: pos } : pl)) };
}

function own(s: GameState, pos: number, owner: number): GameState {
  return { ...s, tiles: s.tiles.map((t, i) => (i === pos ? { ...t, owner } : t)) };
}

const roll = (a: number, b: number) => ({ t: "roll", forced: { a, b } }) as const;

/**
 * Puts the game back to a clean start-of-turn. Cards move players, jail them
 * and put them in debt; this test is only interested in the deck, so the rest
 * of the state is reset rather than played out.
 */
function forceTurnStart(s: GameState): GameState {
  return {
    ...s,
    phase: "turn-start",
    buyTile: null,
    auction: null,
    debt: null,
    card: null,
    doublesCount: 0,
    players: s.players.map((p) => ({
      ...p,
      position: 0,
      money: 5000,
      inJail: false,
      jailAttempts: 0,
      bankrupt: false,
    })),
  };
}

/** Walks the current player onto a chance tile and acknowledges the draw. */
function drawOneCard(start: GameState): GameState {
  // Tile 7 is a chance square; from 0 a 3+4 lands on it exactly.
  const s = applyAction(forceTurnStart(start), roll(3, 4)).state;
  if (s.phase !== "card") return s;
  return applyAction(s, { t: "ack-card" }).state;
}

describe("card decks", () => {
  it("returns spent cards so a deck can be rebuilt instead of running dry", () => {
    let s = makeGame();
    s = drawOneCard(s);

    expect(s.decks.chance.length + s.discards.chance.length).toBeGreaterThan(0);
    // The drawn card must now sit somewhere other than the deck it came from,
    // either in the discard pile or held by the player as a jail card.
    const held = s.players.reduce((n, p) => n + p.getOutCards, 0);
    expect(s.discards.chance.length + held).toBe(1);
  });

  it("survives more draws than a deck holds", () => {
    let s = makeGame();
    // Forty draws against a sixteen-card deck: the old code emptied the deck
    // for good and wedged the game in the `card` phase on the seventeenth.
    for (let i = 0; i < 40; i++) {
      s = drawOneCard(s);
      expect(s.phase).not.toBe("card");
    }

    expect(s.card).toBeNull();
  });
});

describe("applyAction purity", () => {
  it("does not mutate the previous state during an auction", () => {
    let s = place(makeGame(3), 0, 0);
    s = applyAction(s, roll(1, 2)).state; // land on a buyable street
    s = applyAction(s, { t: "decline" }).state;
    expect(s.phase).toBe("auction");

    const before = structuredClone(s);
    applyAction(s, { t: "bid", amount: 50 });
    expect(s).toEqual(before);

    applyAction(s, { t: "auction-pass" });
    expect(s).toEqual(before);
  });
});

describe("bid validation", () => {
  function auctionState(): GameState {
    let s = place(makeGame(3), 0, 0);
    s = applyAction(s, roll(1, 2)).state;
    return applyAction(s, { t: "decline" }).state;
  }

  it("rejects a bid that is not a whole positive number", () => {
    const s = auctionState();
    // NaN passes both `> money` and `<= highBid`, so it used to be accepted
    // and then serialise as null.
    expect(() => applyAction(s, { t: "bid", amount: Number.NaN })).toThrow();
    expect(() => applyAction(s, { t: "bid", amount: 10.5 })).toThrow();
    expect(() => applyAction(s, { t: "bid", amount: 0 })).toThrow();
    expect(() => applyAction(s, { t: "bid", amount: -20 })).toThrow();
  });
});

describe("board index validation", () => {
  it("rejects an out-of-range tile as a rule, not a crash", () => {
    const s = makeGame();
    expect(() => applyAction(s, { t: "mortgage", pos: 999 })).toThrow("Case inconnue");
    expect(() => applyAction(s, { t: "build", pos: -1 })).toThrow("Case inconnue");
  });
});

describe("raising funds while in debt", () => {
  it("lets a cash-poor owner mortgage rather than forcing bankruptcy", () => {
    // J1 owns an expensive street with a hotel; J0 lands on it broke but
    // holding property of their own.
    let s = makeGame();
    s = own(s, 39, 1); // Les Almadies
    s = own(s, 1, 0); // something J0 can mortgage
    s = {
      ...s,
      tiles: s.tiles.map((t, i) => (i === 39 ? { ...t, houses: 5 } : t)),
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 5 } : p)),
    };
    s = place(s, 0, 37);
    s = applyAction(s, roll(1, 1)).state;

    expect(s.phase).toBe("debt");
    const before = s.players[0]?.money ?? 0;

    const after = applyAction(s, { t: "mortgage", pos: 1 }).state;
    expect(after.players[0]?.money ?? 0).toBeGreaterThan(before);
    expect(after.tiles[1]?.mortgaged).toBe(true);
  });

  it("still refuses to build while in debt", () => {
    let s = makeGame();
    s = own(s, 39, 1);
    s = {
      ...s,
      tiles: s.tiles.map((t, i) => (i === 39 ? { ...t, houses: 5 } : t)),
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 5 } : p)),
    };
    s = place(s, 0, 37);
    s = applyAction(s, roll(1, 1)).state;

    expect(s.phase).toBe("debt");
    expect(() => applyAction(s, { t: "build", pos: 1 })).toThrow();
  });
});

describe("trading before the roll", () => {
  it("accepts an offer made at the start of a turn", () => {
    let s = makeGame();
    s = own(s, 1, 0);
    expect(s.phase).toBe("turn-start");

    const offered = applyAction(s, {
      t: "offer-trade",
      offer: { to: 1, giveMoney: 0, giveProps: [1], takeMoney: 100, takeProps: [] },
    }).state;
    const after = applyAction(offered, { t: "accept-trade" }).state;

    expect(after.tiles[1]?.owner).toBe(1);
    expect(after.players[0]?.money).toBe(1600);
  });
});

/**
 * An offer used to execute the instant it was made. On one screen that is
 * only impolite; across a network it is a way to take somebody's property
 * without ever asking them.
 */
describe("trades need both sides", () => {
  function offered(): GameState {
    let s = makeGame();
    s = own(s, 1, 0);
    s = own(s, 5, 1);
    return applyAction(s, {
      t: "offer-trade",
      offer: { to: 1, giveMoney: 200, giveProps: [1], takeMoney: 0, takeProps: [5] },
    }).state;
  }

  it("moves nothing at all when the offer is made", () => {
    const s = offered();
    expect(s.pendingTrade).not.toBeNull();
    expect(s.tiles[1]?.owner).toBe(0);
    expect(s.tiles[5]?.owner).toBe(1);
    expect(s.players[0]?.money).toBe(1500);
    expect(s.players[1]?.money).toBe(1500);
  });

  it("moves everything once it is accepted", () => {
    const s = applyAction(offered(), { t: "accept-trade" }).state;
    expect(s.pendingTrade).toBeNull();
    expect(s.tiles[1]?.owner).toBe(1);
    expect(s.tiles[5]?.owner).toBe(0);
    expect(s.players[0]?.money).toBe(1300);
    expect(s.players[1]?.money).toBe(1700);
  });

  it("moves nothing when it is refused", () => {
    const s = applyAction(offered(), { t: "reject-trade" }).state;
    expect(s.pendingTrade).toBeNull();
    expect(s.tiles[1]?.owner).toBe(0);
    expect(s.players[0]?.money).toBe(1500);
  });

  it("moves nothing when the proposer takes it back", () => {
    const s = applyAction(offered(), { t: "withdraw-trade" }).state;
    expect(s.pendingTrade).toBeNull();
    expect(s.tiles[1]?.owner).toBe(0);
  });

  it("refuses a second offer while one is waiting", () => {
    expect(() =>
      applyAction(offered(), {
        t: "offer-trade",
        offer: { to: 1, giveMoney: 1, giveProps: [], takeMoney: 0, takeProps: [] },
      }),
    ).toThrow();
  });

  it("lets the offer lapse with the turn rather than outlive it", () => {
    // Accepting it during somebody else's turn would settle it against a
    // board that has moved on since.
    let s = applyAction(offered(), { t: "roll", forced: { a: 1, b: 2 } }).state;
    s = { ...s, phase: "post-roll", buyTile: null, auction: null, debt: null, card: null };
    const ended = applyAction(s, { t: "end-turn" }).state;
    expect(ended.pendingTrade).toBeNull();
    expect(ended.tiles[1]?.owner).toBe(0);
  });

  it("checks the offer again before settling it", () => {
    // The proposer spent the money they promised between offering and being
    // answered; the deal must not go through on credit.
    const s = offered();
    const broke: GameState = {
      ...s,
      players: s.players.map((pl, i) => (i === 0 ? { ...pl, money: 10 } : pl)),
    };
    expect(() => applyAction(broke, { t: "accept-trade" })).toThrow("Fonds insuffisants");
  });

  it("refuses an answer when nothing is on the table", () => {
    expect(() => applyAction(makeGame(), { t: "accept-trade" })).toThrow();
    expect(() => applyAction(makeGame(), { t: "reject-trade" })).toThrow();
  });
});

describe("cards that send a player somewhere", () => {
  /** Draws until the named card comes up, then acknowledges it. */
  function playCard(cardId: string, from: number) {
    let s = makeGame();
    s = {
      ...s,
      phase: "card",
      card: { deck: "chance", cardId },
      players: s.players.map((p, i) => (i === 0 ? { ...p, position: from } : p)),
    };
    return applyAction(s, { t: "ack-card" });
  }

  it("walks the token instead of snapping it to the tile", () => {
    // "Avancez jusqu'aux Almadies" — tile 39, from tile 5.
    const { state, events } = playCard("baraka-almadies", 5);

    const walk = events.find((e) => e.t === "move-steps");
    expect(walk).toBeDefined();
    expect(walk?.t === "move-steps" && walk.steps).toBe(34);
    // Nothing may jump: a player who never sees the move cannot follow it.
    expect(events.some((e) => e.t === "teleport")).toBe(false);
    expect(state.players[0]?.position).toBe(39);
  });

  it("walks forward past the Départ and collects the salary", () => {
    // "Le TER vous attend" — tile 5, from tile 7, so the long way round.
    const before = makeGame().players[0]?.money ?? 0;
    const { state, events } = playCard("baraka-ter", 7);

    const walk = events.find((e) => e.t === "move-steps");
    expect(walk?.t === "move-steps" && walk.steps).toBe(38);
    expect(state.players[0]?.position).toBe(5);
    expect(state.players[0]?.money).toBe(before + 200);
  });

  it("emits the walk before whatever the destination triggers", () => {
    const { events } = playCard("baraka-almadies", 5);
    const walkAt = events.findIndex((e) => e.t === "move-steps");
    const moneyAt = events.findIndex((e) => e.t === "money");

    expect(walkAt).toBeGreaterThanOrEqual(0);
    // Anything that happens *because* of the arrival has to come after it,
    // or the board tells the story out of order.
    if (moneyAt >= 0) expect(walkAt).toBeLessThan(moneyAt);
  });

  it("pays the salary when the nearest station is round past the Départ", () => {
    const before = makeGame().players[0]?.money ?? 0;
    // From tile 37 the next station is tile 5, the long way round.
    const { state, events } = playCard("baraka-gare-1", 37);

    expect(events.some((e) => e.t === "move-steps")).toBe(true);
    expect(state.players[0]?.money).toBe(before + 200);
  });
});
