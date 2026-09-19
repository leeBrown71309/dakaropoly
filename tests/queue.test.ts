import { beforeEach, describe, expect, it, vi } from "vitest";

// The real throw is a rigid-body simulation worth a couple of seconds of
// recorded motion. What is under test here is the animation queue, not the
// physics, so the dice land instantly.
vi.mock("../src/animation/diceRoll", () => ({
  simulateThrow: () => ({ dice: [], duration: 0 }),
}));

import { useGame } from "../src/game/store";
import type { GameState } from "../src/game/types";

/**
 * Regression tests for the event queue, which is where the rules and the
 * board fall out of step.
 *
 * Online, the acknowledgement of a card travels over the wire, but the
 * promise it releases only exists once *this* device's queue has reached the
 * card. Two devices drain the same events at different speeds — token pace
 * and announcement duration are settings each player owns — so the ack can
 * arrive first, and used to resolve nothing at all.
 */
function startGame(): void {
  useGame.getState().startGame(
    [
      { name: "Awa", pawn: 0 },
      { name: "Modou", pawn: 1 },
    ],
    7,
  );
  // The pacing is the player's to choose; here it only needs to be short.
  useGame.setState({
    settings: { ...useGame.getState().settings, stepDuration: 1, announceDuration: 1, toastDuration: 1 },
  });
}

/** Puts the current player three tiles short of the Baraka square at 7. */
function standBeforeTheDeck(): void {
  useGame.setState((s) => {
    const game = s.game as GameState;
    return {
      game: { ...game, players: game.players.map((p, i) => (i === 0 ? { ...p, position: 4 } : p)) },
    };
  });
}

describe("a card that is acknowledged before the queue reaches it", () => {
  beforeEach(() => {
    startGame();
    standBeforeTheDeck();
  });

  it("draws a card and parks the queue in the ordinary case", async () => {
    useGame.getState().applyLocally({ t: "roll", forced: { a: 1, b: 2 } });

    // The rules are already at the card; the board has not caught up yet.
    expect(useGame.getState().game?.phase).toBe("card");
    await vi.waitFor(() => expect(useGame.getState().cardView).not.toBeNull());
    expect(useGame.getState().animating).toBe(true);

    useGame.getState().applyLocally({ t: "ack-card" });
    await vi.waitFor(() => expect(useGame.getState().animating).toBe(false), { timeout: 4000 });
  });

  it("lets the queue through when the ack outruns it", async () => {
    const store = useGame.getState();
    store.applyLocally({ t: "roll", forced: { a: 1, b: 2 } });
    expect(store.game !== null).toBe(true);
    expect(useGame.getState().game?.phase).toBe("card");

    // The queue is still on the dice, so nothing is parked on a promise yet.
    expect(useGame.getState().cardResolve).toBeNull();
    // The player who drew it dismissed the card on their own device first.
    store.applyLocally({ t: "ack-card" });

    // Without the latch the pump reaches `show-card` a moment later, parks on
    // a promise whose release has already been and gone, and never moves
    // again: `animating` stays true for the rest of the evening and every
    // contextual panel — the auction's included — is simply never rendered.
    await vi.waitFor(() => expect(useGame.getState().animating).toBe(false), { timeout: 4000 });
    expect(useGame.getState().cardView).toBeNull();
  });
});

describe("what applyLocally reports back", () => {
  beforeEach(() => {
    startGame();
  });

  it("says yes when the engine takes the action", () => {
    expect(useGame.getState().applyLocally({ t: "roll", forced: { a: 1, b: 3 } })).toBe(true);
  });

  it("says no when the engine refuses it", () => {
    // The relay counts on this: an action refused here is one the sender's
    // board took, and treating it as played would leave two boards at the
    // same version with different games and nothing left to notice it.
    expect(useGame.getState().applyLocally({ t: "end-turn" })).toBe(false);
  });

  it("frees the queue even when the acknowledgement is refused", async () => {
    standBeforeTheDeck();
    useGame.getState().applyLocally({ t: "roll", forced: { a: 1, b: 2 } });
    await vi.waitFor(() => expect(useGame.getState().cardResolve).not.toBeNull());

    // A duplicate ack, or one landing after a resync: the engine throws
    // because there is no card phase left, and the release used to be inside
    // the same try — so the pump stayed parked for good.
    useGame.setState((s) => ({ game: { ...(s.game as GameState), phase: "post-roll", card: null } }));
    expect(useGame.getState().applyLocally({ t: "ack-card" })).toBe(false);

    await vi.waitFor(() => expect(useGame.getState().animating).toBe(false), { timeout: 4000 });
    // Nothing is remembered: the next card must still be shown.
    expect(useGame.getState().earlyCardAck).toBe(false);
  });
});
