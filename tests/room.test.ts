import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../src/game/engine";
import { mayAct } from "../src/game/selectors";
import { formatCode, normaliseCode, seatOffers, type RoomRow, type Seat } from "../src/net/room";
import type { GameState } from "../src/game/types";

/**
 * Which chairs a latecomer is offered at a game already under way.
 *
 * The database re-checks every one of these before handing a seat over, but
 * this is what the player is looking at when they decide — an offer that lies
 * either loses somebody their seat or dangles one that cannot be taken.
 */

const CLIENTS = ["aaa", "bbb", "ccc"];

function table(): GameState {
  return createGame(
    [
      { name: "Awa", pawn: 0 },
      { name: "Modou", pawn: 3 },
      { name: "Fatou", pawn: 5 },
    ],
    7,
  );
}

function room(state: GameState = table()): RoomRow {
  return {
    code: "ABC123",
    status: "playing",
    hostId: CLIENTS[0] as string,
    seed: 7,
    state,
    version: 12,
    seatOrder: [...CLIENTS],
  };
}

/** A roster row. The name is deliberately wrong; the board is the authority. */
function row(clientId: string, seat: number, absent = false): Seat {
  return { clientId, seat, name: "rosterName", pawn: 99, avatar: null, absent };
}

const full = () => CLIENTS.map((c, i) => row(c, i));

describe("seat offers", () => {
  it("names the players from the board, not from the roster", () => {
    const offers = seatOffers(room(), full(), "zzz");

    expect(offers.map((o) => o.name)).toEqual(["Awa", "Modou", "Fatou"]);
    // The pawn decides the colour and the glyph, so a wrong one would show a
    // stranger's token next to a familiar name.
    expect(offers.map((o) => o.pawn)).toEqual([0, 3, 5]);
  });

  it("holds a chair whose player is still reporting in", () => {
    const offers = seatOffers(room(), full(), "zzz");
    expect(offers.every((o) => !o.free)).toBe(true);
  });

  it("frees a chair whose player has left the room", () => {
    // Leaving deletes the roster row, so seat 2 has nobody holding it.
    const offers = seatOffers(room(), [row(CLIENTS[0] as string, 0), row(CLIENTS[1] as string, 1)], "zzz");

    expect(offers[2]?.free).toBe(true);
    expect(offers[2]?.name).toBe("Fatou");
    expect(offers[0]?.free).toBe(false);
  });

  it("frees a chair whose player has gone quiet", () => {
    const seats = [row(CLIENTS[0] as string, 0), row(CLIENTS[1] as string, 1), row(CLIENTS[2] as string, 2, true)];
    const offers = seatOffers(room(), seats, "zzz");

    expect(offers[2]?.free).toBe(true);
    expect(offers[2]?.mine).toBe(false);
  });

  it("always offers you your own chair back", () => {
    // Same tab, reloaded: the row is still there and still fresh, and the
    // chair is still theirs. Anything else strands a player at their own game.
    const offers = seatOffers(room(), full(), CLIENTS[1] as string);

    expect(offers[1]?.mine).toBe(true);
    expect(offers[1]?.free).toBe(true);
    expect(offers[0]?.free).toBe(false);
    expect(offers[2]?.free).toBe(false);
  });

  it("never offers a chair that has gone bankrupt", () => {
    const state = table();
    const broke: GameState = {
      ...state,
      players: state.players.map((p, i) => (i === 2 ? { ...p, bankrupt: true } : p)),
    };
    // Nobody is holding it, so only being out of the game keeps it shut.
    const offers = seatOffers(room(broke), [row(CLIENTS[0] as string, 0)], "zzz");

    expect(offers[2]?.out).toBe(true);
    expect(offers[2]?.free).toBe(false);
    expect(offers[1]?.free).toBe(true);
  });
});

describe("room codes", () => {
  it("keeps only characters the alphabet can hold", () => {
    expect(normaliseCode("abc-234")).toBe("ABC234");
    expect(normaliseCode("a b/c!2*3#4")).toBe("ABC234");
    expect(normaliseCode("ABC23456789")).toHaveLength(6);
    // 0, 1, I, L and O are not in the alphabet at all: they are the ones
    // misread off a screen or misheard across a room, so they fall away
    // rather than turning into a code that looks right and is not.
    expect(normaliseCode("O0I1L")).toBe("");
  });

  it("reads back in two halves", () => {
    expect(formatCode("ABC234")).toBe("ABC-234");
  });
});

describe("who may act", () => {
  const game = () => table();

  it("lets a hot-seat device play for whoever is to move", () => {
    // One screen, one seat: the local game must behave exactly as it always
    // has, whatever the online plumbing now knows about seats.
    expect(mayAct(game(), false, null)).toBe(true);
  });

  it("gives the turn to one seat only", () => {
    const s = game();
    expect(mayAct(s, true, 0)).toBe(true);
    expect(mayAct(s, true, 1)).toBe(false);
    expect(mayAct(s, true, 2)).toBe(false);
  });

  it("never lets a spectator play", () => {
    // A spectator has no seat, which reads as the same `null` a hot-seat
    // game uses for "speaks for everyone". Told apart they must be: the
    // relay would have broadcast whatever they pressed to the whole room.
    expect(mayAct(game(), true, null)).toBe(false);
  });

  it("follows the bidding queue during an auction, not the turn", () => {
    let s = game();
    s = applyAction(s, { t: "roll", forced: { a: 1, b: 2 } }).state;
    s = applyAction(s, { t: "decline" }).state;
    expect(s.phase).toBe("auction");

    const floor = s.auction?.order[0];
    expect(floor).toBeDefined();
    expect(mayAct(s, true, floor as number)).toBe(true);
    // Including the player whose turn it nominally is, once they have bid.
    for (const other of [0, 1, 2].filter((i) => i !== floor)) {
      expect(mayAct(s, true, other)).toBe(false);
    }
  });

  it("gives the turn to nobody once the game is over", () => {
    const s: GameState = { ...game(), phase: "game-over", winner: 0 };
    expect(mayAct(s, true, 0)).toBe(false);
    expect(mayAct(s, true, 1)).toBe(false);
  });
});
