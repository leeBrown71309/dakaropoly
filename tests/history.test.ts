import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../src/game/engine";
import {
  durationOf,
  finalBoardOf,
  mySeat,
  nameOf,
  placeOf,
  takeoversIn,
  wonBy,
  type HistoryGame,
  type HistorySeat,
} from "../src/net/history";

const MOUSSA = "acc-moussa";
const AWA = "acc-awa";
const FATOU = "acc-fatou";

const seat = (s: number, accountId: string | null, name: string, fromTurn = 0): HistorySeat => ({
  seat: s,
  accountId,
  name,
  pawn: s,
  fromTurn,
});

/**
 * Three chairs: Moussa wins in chair 0, a guest starts chair 1 and Awa takes
 * it over on turn 30, Fatou goes out first in chair 2.
 */
function finishedGame(): HistoryGame {
  let board = createGame(
    [
      { name: "Moussa", pawn: 0 },
      { name: "Invité", pawn: 1 },
      { name: "Fatou", pawn: 2 },
    ],
    3,
  );
  board = applyAction(board, { t: "resign", playerId: 2 }).state;
  board = applyAction(board, { t: "resign", playerId: 1 }).state;
  return {
    id: "g1",
    status: "finished",
    startedAt: "2026-09-20T20:00:00Z",
    endedAt: "2026-09-20T21:24:00Z",
    turnCount: board.turnCount,
    winner: board.winner,
    final: board,
    seats: [seat(0, MOUSSA, "Moussa"), seat(1, null, "Invité"), seat(1, AWA, "Awa", 30), seat(2, FATOU, "Fatou")],
  };
}

describe("history", () => {
  it("finds the chair each account held", () => {
    const g = finishedGame();
    expect(mySeat(g, MOUSSA)).toBe(0);
    expect(mySeat(g, AWA)).toBe(1);
    expect(mySeat(g, "stranger")).toBeNull();
  });

  it("gives each chair its final place", () => {
    const g = finishedGame();
    expect(g.winner).toBe(0);
    expect(placeOf(g, 0)).toBe(1);
    expect(placeOf(g, 1)).toBe(2);
    expect(placeOf(g, 2)).toBe(3);
  });

  it("credits the win to whoever held the winning chair at the end", () => {
    const g = finishedGame();
    expect(wonBy(g, MOUSSA)).toBe(true);
    expect(wonBy(g, AWA)).toBe(false);
  });

  it("does not credit a win to somebody who left the winning chair", () => {
    const g = finishedGame();
    const taken = { ...g, seats: [...g.seats, seat(0, FATOU, "Fatou", 50)] };
    expect(wonBy(taken, MOUSSA)).toBe(false);
    expect(wonBy(taken, FATOU)).toBe(true);
    // Moussa still played that chair: the game is his, and so is its place.
    expect(mySeat(taken, MOUSSA)).toBe(0);
  });

  it("never calls an unfinished game a win", () => {
    const g = { ...finishedGame(), status: "unfinished" as const };
    expect(wonBy(g, MOUSSA)).toBe(false);
  });

  it("lists every chair that changed hands", () => {
    const [takeover, ...rest] = takeoversIn(finishedGame());
    expect(rest).toHaveLength(0);
    expect(takeover?.seat).toBe(1);
    expect(takeover?.from.name).toBe("Invité");
    expect(takeover?.to.accountId).toBe(AWA);
    expect(takeover?.to.fromTurn).toBe(30);
  });

  it("names an account by its pseudo today, and anyone else as they sat", () => {
    const people = { [MOUSSA]: { pseudo: "Moussa_2", avatar: null } };
    expect(nameOf(seat(0, MOUSSA, "Moussa"), people)).toBe("Moussa_2");
    expect(nameOf(seat(1, null, "Invité"), people)).toBe("Invité");
    // An account deleted since: no entry among the people any more.
    expect(nameOf(seat(2, FATOU, "Fatou"), people)).toBe("Fatou");
  });

  it("puts today's names on the final board", () => {
    const people = { [MOUSSA]: { pseudo: "Moussa_2", avatar: null }, [AWA]: { pseudo: "Awa", avatar: null } };
    const board = finalBoardOf(finishedGame(), people);
    expect(board?.players.map((p) => p.name)).toEqual(["Moussa_2", "Awa", "Fatou"]);
  });

  it("measures how long the game lasted", () => {
    expect(durationOf(finishedGame())).toBe(84 * 60 * 1000);
    expect(durationOf({ ...finishedGame(), endedAt: null })).toBeNull();
  });

  it("has no place and no board while the game is still being played", () => {
    const g = { ...finishedGame(), status: "playing" as const, final: null };
    expect(placeOf(g, 0)).toBeNull();
    expect(finalBoardOf(g, {})).toBeNull();
  });
});
