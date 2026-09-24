import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../src/game/engine";
import { standingsOf } from "../src/game/selectors";
import type { GameState, Player } from "../src/game/types";

/**
 * The one ranking of a table, shared by the end-of-game screen and the
 * history of past games. Eliminated players used to tie at zero and come out
 * in array order, whoever had held on the longest.
 */

function makeGame(playerCount: number): GameState {
  return createGame(
    Array.from({ length: playerCount }, (_, i) => ({ name: `J${i}`, pawn: i })),
    11,
  );
}

const ids = (players: Player[]): number[] => players.map((p) => p.id);

function withMoney(s: GameState, money: Record<number, number>): GameState {
  return {
    ...s,
    players: s.players.map((p) => (money[p.id] === undefined ? p : { ...p, money: money[p.id] as number })),
  };
}

describe("standingsOf", () => {
  it("ranks the players still in the game by net worth", () => {
    const s = withMoney(makeGame(3), { 0: 900, 1: 2400, 2: 1500 });
    expect(ids(standingsOf(s))).toEqual([1, 2, 0]);
  });

  it("counts each departure in the order it happened", () => {
    let s = makeGame(4);
    s = applyAction(s, { t: "resign", playerId: 3 }).state;
    s = applyAction(s, { t: "resign", playerId: 1 }).state;
    expect(s.players[3]?.eliminationOrder).toBe(1);
    expect(s.players[1]?.eliminationOrder).toBe(2);
    expect(s.players[0]?.eliminationOrder).toBeNull();
  });

  it("puts the eliminated below everyone left, the last to fall highest", () => {
    let s = makeGame(4);
    s = applyAction(s, { t: "resign", playerId: 3 }).state;
    s = applyAction(s, { t: "resign", playerId: 1 }).state;
    s = withMoney(s, { 0: 500, 2: 3000 });
    expect(ids(standingsOf(s))).toEqual([2, 0, 1, 3]);
  });

  it("numbers a bankruptcy like a resignation", () => {
    let s = makeGame(3);
    s = applyAction(s, { t: "resign", playerId: 2 }).state;
    s = {
      ...s,
      current: 0,
      phase: "debt",
      debt: { amount: 10000, creditor: null, distribute: false, after: "continue", moveSteps: 0 },
    };
    const res = applyAction(s, { t: "declare-bankruptcy" });
    expect(res.state.players[0]?.eliminationOrder).toBe(2);
    expect(ids(standingsOf(res.state))).toEqual([1, 0, 2]);
  });

  it("reads a board recorded before departures were counted", () => {
    let s = makeGame(3);
    s = applyAction(s, { t: "resign", playerId: 1 }).state;
    // Snapshots written by an older client carry no field at all.
    const legacy = {
      ...s,
      players: s.players.map((p) => {
        const copy: Partial<Player> = { ...p };
        delete copy.eliminationOrder;
        return copy as Player;
      }),
    };
    expect(ids(standingsOf(legacy)).slice(-1)).toEqual([1]);
  });
});
