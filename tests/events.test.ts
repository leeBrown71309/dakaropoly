import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../src/game/engine";
import type { GameEvent, GameState } from "../src/game/types";

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

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.t);

function announcements(events: GameEvent[]) {
  return events.filter((e): e is Extract<GameEvent, { t: "announce" }> => e.t === "announce");
}

/**
 * These cover the difference between the engine *knowing* something happened
 * and the players being *told*. Money must never leave an account without an
 * event the interface can surface.
 */
describe("player-facing events", () => {
  it("announces the tax when landing on an income tax tile", () => {
    const s = place(makeGame(), 0, 0);
    const { events } = applyAction(s, roll(1, 3)); // 0 + 4 -> income tax

    const announced = announcements(events);
    expect(announced).toHaveLength(1);
    expect(announced[0]?.kind).toBe("tax");
    expect(announced[0]?.amount).toBe(200);
  });

  it("announces the trip to jail before the token is moved there", () => {
    const s = place(makeGame(), 0, 25);
    const { events } = applyAction(s, roll(2, 3)); // 25 + 5 -> go to jail

    const order = kinds(events);
    const announceAt = order.indexOf("announce");
    const jailAt = order.indexOf("jail-in");

    expect(announceAt).toBeGreaterThanOrEqual(0);
    expect(jailAt).toBeGreaterThanOrEqual(0);
    expect(announceAt).toBeLessThan(jailAt);
    expect(announcements(events)[0]?.kind).toBe("jail");
  });

  it("announces rent, with the amount actually charged", () => {
    let s = place(makeGame(), 0, 0);
    s = own(s, 6, 1); // Parcelles Assainies belongs to the other player
    const { state, events } = applyAction(s, roll(2, 4)); // 0 + 6

    const announced = announcements(events);
    expect(announced[0]?.kind).toBe("rent");
    expect(announced[0]?.amount).toBe(6);
    expect(state.players[0]?.money).toBe(1500 - 6);
    expect(state.players[1]?.money).toBe(1500 + 6);
  });

  it("announces three doubles as a trip to jail", () => {
    let s = makeGame();
    ({ state: s } = applyAction(s, roll(2, 2)));
    ({ state: s } = applyAction(s, roll(3, 3)));
    const { events } = applyAction(s, roll(4, 4));

    expect(announcements(events).some((a) => a.kind === "jail")).toBe(true);
  });

  it("records what the players were told in the journal", () => {
    const before = place(makeGame(), 0, 0);
    expect(before.log).toHaveLength(1);

    const { state } = applyAction(before, roll(1, 3)); // income tax
    expect(state.log.length).toBeGreaterThan(1);
    expect(state.log.some((line) => line.includes("banque"))).toBe(true);
  });

  it("still emits a toast for the salary, so passing Go is never silent", () => {
    const s = place(makeGame(), 0, 38);
    const { events } = applyAction(s, roll(2, 3)); // wraps past Go

    const toasts = events.filter((e) => e.t === "toast");
    expect(toasts.some((t) => t.t === "toast" && t.text.includes("Départ"))).toBe(true);
  });
});
