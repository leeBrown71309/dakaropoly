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
    // The turn used to be advanced with a roll, which is now refused while an
    // offer waits; the phase was overwritten straight afterwards anyway, so
    // setting it is what the test always meant.
    const s: GameState = { ...offered(), phase: "post-roll" };
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

describe("jail fine paid through a debt", () => {
  it("resolves the walk that follows the payment", () => {
    // Three failed attempts forced the 50 F fine through the debt phase,
    // whose "release-move" then walked the player. The walk left the phase
    // at "debt" with no debt: any payable rent on the landing square wedged
    // the game for good.
    let s = makeGame();
    s = own(s, 13, 1); // Hann-Maristes, rent 10 F bare
    s = own(s, 1, 0); // Pikine, mortgaged by J0 to raise the fine
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: 10, inJail: true, jailAttempts: 2, money: 40 } : p,
      ),
    };

    s = applyAction(s, roll(1, 2)).state; // third failure, cannot pay
    expect(s.phase).toBe("debt");
    expect(s.debt?.after).toBe("release-move");

    s = applyAction(s, { t: "mortgage", pos: 1 }).state; // 40 + 30 = 70
    s = applyAction(s, { t: "pay-debt" }).state; // 70 − 50, then walk to 13

    expect(s.debt).toBeNull();
    expect(s.phase).toBe("post-roll");
    expect(s.players[0]?.money).toBe(10); // 20 − 10 F rent
    expect(s.players[1]?.money).toBe(1510);
  });
});

describe("bankruptcy to the bank", () => {
  it("auctions each holding exactly once, then hands the turn over", () => {
    // The debtor's tiles are auctioned by the bank at their moment of
    // bankruptcy; the first was in the queue *and* started at once, so every
    // estate sold twice. When the last hammer fell, the turn stayed with the
    // bankrupt player — an actor no legal action could ever move on.
    let s = makeGame(3);
    s = own(s, 1, 0);
    s = own(s, 3, 0);
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 999, creditor: null, distribute: false, after: "continue", moveSteps: 0 },
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 0 } : p)),
    };

    s = applyAction(s, { t: "declare-bankruptcy" }).state;
    expect(s.phase).toBe("auction");
    expect(s.auction?.pos).toBe(1);
    expect(s.players[0]?.bankrupt).toBe(true);

    s = applyAction(s, { t: "auction-pass" }).state;
    s = applyAction(s, { t: "auction-pass" }).state;
    expect(s.phase).toBe("auction");
    expect(s.auction?.pos).toBe(3);

    s = applyAction(s, { t: "auction-pass" }).state;
    s = applyAction(s, { t: "auction-pass" }).state;
    expect(s.phase).toBe("turn-start");
    expect(s.current).toBe(1);
    expect(s.winner).toBeNull();
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

describe("buildings go back on the bank's shelf", () => {
  /** Hands a group to one player and builds `each` buildings on every tile. */
  function built(playerCount: number, group: number[], each: number): GameState {
    let s = makeGame(playerCount);
    for (const pos of group) s = own(s, pos, 0);
    for (let n = 0; n < each; n++) {
      for (const pos of group) s = applyAction(s, { t: "build", pos }).state;
    }
    return s;
  }

  /** Puts the current player in an unpayable debt, ready to give up. */
  function ruined(s: GameState, creditor: number | null): GameState {
    return {
      ...s,
      phase: "debt",
      debt: { amount: 99_999, creditor, distribute: false, after: "continue", moveSteps: 0 },
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 0 } : p)),
    };
  }

  it("returns houses to the bank when an estate is auctioned off", () => {
    // Pikine and Guediawaye, three houses each: six off the shelf.
    let s = built(3, [1, 3], 3);
    expect(s.houseStock).toBe(26);

    s = applyAction(ruined(s, null), { t: "declare-bankruptcy" }).state;

    expect(s.tiles[1]?.houses).toBe(0);
    expect(s.tiles[3]?.houses).toBe(0);
    // The board is bare, so the bank holds all of them again. It used to
    // hold 26 for ever, and the six it had lost stood nowhere at all.
    expect(s.houseStock).toBe(32);
    expect(s.hotelStock).toBe(12);
  });

  it("returns hotels when the estate passes to another player", () => {
    // A hotel gave its four houses back when it was built, so only the
    // hotel itself comes home.
    let s = built(2, [1, 3], 5);
    expect(s.hotelStock).toBe(10);
    expect(s.houseStock).toBe(32);

    s = applyAction(ruined(s, 1), { t: "declare-bankruptcy" }).state;

    expect(s.hotelStock).toBe(12);
    expect(s.houseStock).toBe(32);
  });

  it("does not trap an owner of hotels who could have sold one", () => {
    // Two hotels, a 300 F debt, nothing in hand. Selling is the way out —
    // it was refused because the bank believed it had no houses to give
    // back, having lost them to earlier bankruptcies that never restocked.
    let s = built(2, [1, 3], 5);
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 300, creditor: 1, distribute: false, after: "continue", moveSteps: 0 },
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 0 } : p)),
    };

    s = applyAction(s, { t: "sell-house", pos: 1 }).state;
    s = applyAction(s, { t: "sell-house", pos: 3 }).state;

    expect(s.players[0]?.money).toBe(250); // 125 F per hotel on a 50 F street
    expect(s.hotelStock).toBe(12);
  });
});

describe("an eliminated player has left the table", () => {
  it("is no longer in jail", () => {
    let s = makeGame(3);
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 99_999, creditor: 1, distribute: false, after: "continue", moveSteps: 0 },
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, money: 0, position: 10, inJail: true, jailAttempts: 2 } : p,
      ),
    };

    s = applyAction(s, { t: "declare-bankruptcy" }).state;

    expect(s.players[0]?.bankrupt).toBe(true);
    // The roster prints a jail mark from this flag alone, so a player who
    // had left the game went on sitting in Rebeuss beside the living.
    expect(s.players[0]?.inJail).toBe(false);
    expect(s.players[0]?.jailAttempts).toBe(0);
  });
});

describe("inherited mortgages cost something visible", () => {
  it("announces the 10 % interest instead of taking it in silence", () => {
    let s = makeGame(3);
    s = { ...s, tiles: s.tiles.map((t, i) => (i === 39 ? { ...t, owner: 0, mortgaged: true } : t)) };
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 99_999, creditor: 1, distribute: false, after: "continue", moveSteps: 0 },
      players: s.players.map((p, i) => (i === 0 ? { ...p, money: 0 } : p)),
    };

    const { state, events } = applyAction(s, { t: "declare-bankruptcy" });

    expect(state.players[1]?.money).toBe(1480); // 10 % of the 200 F mortgage
    const fee = events.find((e) => e.t === "money" && e.player === 1 && e.amount === -20);
    expect(fee).toBeDefined();
    // Derived from the toast, so the journal carries it too.
    expect(state.log.some((line) => line.includes("10 %"))).toBe(true);
  });
});

describe("an offer is answered before the dice", () => {
  /** J0 offers J1 most of its cash for Almadies, then tries to play on. */
  function offered(): GameState {
    let s = own(makeGame(3), 39, 1);
    return applyAction(s, {
      t: "offer-trade",
      offer: { to: 1, giveMoney: 1450, giveProps: [], takeMoney: 0, takeProps: [39] },
    }).state;
  }

  it("refuses to roll while an offer waits", () => {
    expect(() => applyAction(offered(), roll(1, 2))).toThrow(/offre en cours/);
  });

  it("still lets the turn end, which lapses the offer", () => {
    // Never a dead end: ending the turn clears the table, as it always did.
    const s = applyAction({ ...offered(), phase: "post-roll" }, { t: "end-turn" }).state;
    expect(s.pendingTrade).toBeNull();
  });

  it("keeps a bidder from being drained mid-auction", () => {
    // The full sequence that ended with a high bidder at −1350 F: offer,
    // roll, decline, bid to the hilt, and have the offer accepted while the
    // auction is still running. It cannot start any more.
    let s = offered();
    expect(() => applyAction(s, roll(1, 2))).toThrow();

    s = applyAction(s, { t: "accept-trade" }).state;
    s = applyAction(s, roll(1, 2)).state; // Guediawaye, unowned
    s = applyAction(s, { t: "decline" }).state;
    s = applyAction(s, { t: "bid", amount: 50 }).state;
    s = applyAction(s, { t: "auction-pass" }).state;
    s = applyAction(s, { t: "auction-pass" }).state;

    for (const p of s.players) expect(p.money).toBeGreaterThanOrEqual(0);
  });
});
