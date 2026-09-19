import { describe, expect, it } from "vitest";
import { applyAction, createGame, SALARY, START_MONEY } from "../src/game/engine";
import { rentFor, unmortgageCost } from "../src/game/selectors";
import type { GameState, Player } from "../src/game/types";

function makeGame(playerCount = 2, seed = 42): GameState {
  return createGame(
    Array.from({ length: playerCount }, (_, i) => ({ name: `J${i}`, pawn: i })),
    seed,
  );
}

function p(s: GameState, id: number): Player {
  const player = s.players[id];
  if (!player) throw new Error("no player");
  return player;
}

function place(s: GameState, id: number, pos: number): GameState {
  return { ...s, players: s.players.map((pl, i) => (i === id ? { ...pl, position: pos } : pl)) };
}

function forceTile(
  s: GameState,
  pos: number,
  patch: Partial<GameState["tiles"][number]>,
): GameState {
  return { ...s, tiles: s.tiles.map((t, i) => (i === pos ? { ...t, ...patch } : t)) };
}

const roll = (a: number, b: number) => ({ t: "roll", forced: { a, b } } as const);

describe("moteur Dakaropoly", () => {
  it("crÃ©e une partie avec l'argent de dÃ©part et des pions uniques", () => {
    const s = makeGame(3);
    expect(s.players).toHaveLength(3);
    for (const player of s.players) {
      expect(player.money).toBe(START_MONEY);
      expect(player.position).toBe(0);
    }
    expect(s.tiles).toHaveLength(40);
  });

  it("calcule le loyer de base et double si groupe complet", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    expect(rentFor(s, 1, 7)).toBe(2);
    s = forceTile(s, 3, { owner: 0 });
    expect(rentFor(s, 1, 7)).toBe(4);
  });

  it("double la rente avec maisons", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    s = forceTile(s, 3, { owner: 0 });
    s = forceTile(s, 1, { houses: 2 });
    expect(rentFor(s, 1, 7)).toBe(30);
  });

  it("pas de loyer sur bien hypothÃ©quÃ©", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 1, mortgaged: true });
    expect(rentFor(s, 1, 7)).toBe(0);
  });

  it("les gares montent 25/50/100/200 selon le nombre possÃ©dÃ©", () => {
    let s = makeGame();
    s = forceTile(s, 5, { owner: 0 });
    expect(rentFor(s, 5, 7)).toBe(25);
    s = forceTile(s, 15, { owner: 1 });
    expect(rentFor(s, 15, 7)).toBe(25);
    s = forceTile(s, 25, { owner: 1 });
    s = forceTile(s, 35, { owner: 1 });
    expect(rentFor(s, 15, 7)).toBe(100);
  });

  it("les services coÃ»tent 4Ã— le total des dÃ©s, 10Ã— avec les deux", () => {
    let s = makeGame();
    s = forceTile(s, 12, { owner: 0 });
    expect(rentFor(s, 12, 8)).toBe(32);
    s = forceTile(s, 28, { owner: 0 });
    expect(rentFor(s, 12, 8)).toBe(80);
  });

  it("paie le salaire en passant par le DÃ©part", () => {
    const s = place(makeGame(), 0, 38);
    const res = applyAction(s, roll(1, 2));
    expect(p(res.state, 0).position).toBe(1);
    expect(p(res.state, 0).money).toBe(START_MONEY + SALARY);
  });

  it("double salaire si pile sur le DÃ©part", () => {
    const s = place(makeGame(), 0, 38);
    const res = applyAction(s, roll(1, 1));
    expect(p(res.state, 0).position).toBe(0);
    expect(p(res.state, 0).money).toBe(START_MONEY + SALARY * 2);
  });

  it("aller en prison depuis la case 30", () => {
    const s = place(makeGame(), 0, 28);
    const res = applyAction(s, roll(1, 1));
    expect(p(res.state, 0).position).toBe(10);
    expect(p(res.state, 0).inJail).toBe(true);
  });

  it("trois doubles d'affilÃ©e envoient en prison", () => {
    let s = makeGame();
    let res = applyAction(s, roll(3, 3));
    res = applyAction(res.state, { t: "buy" });
    expect(res.state.phase).toBe("turn-start");
    res = applyAction(res.state, roll(3, 3));
    res = applyAction(res.state, { t: "buy" });
    expect(res.state.phase).toBe("turn-start");
    res = applyAction(res.state, roll(3, 3));
    expect(p(res.state, 0).inJail).toBe(true);
    expect(res.state.phase).toBe("turn-start");
  });

  it("acheter une propriÃ©tÃ© la fait devenir sienne", () => {
    const s = place(makeGame(), 0, 0);
    const res = applyAction(s, roll(1, 2));
    expect(res.state.phase).toBe("buy-decision");
    expect(res.state.buyTile).toBe(3);
    const bought = applyAction(res.state, { t: "buy" });
    expect(bought.state.tiles[3]?.owner).toBe(0);
    expect(p(bought.state, 0).money).toBe(START_MONEY - 60);
  });

  it("refuser dÃ©clenche une enchÃ¨re remportÃ©e par le suivant", () => {
    const s = place(makeGame(), 0, 0);
    const landed = applyAction(s, roll(1, 2));
    const declined = applyAction(landed.state, { t: "decline" });
    expect(declined.state.phase).toBe("auction");
    expect(declined.state.auction?.order).toContain(1);
    const raised = applyAction(declined.state, { t: "bid", amount: 30 });
    const withdrawn = applyAction(raised.state, { t: "auction-pass" });
    expect(withdrawn.state.tiles[3]?.owner).toBe(1);
    expect(p(withdrawn.state, 1).money).toBe(START_MONEY - 30);
  });

  it("enchÃ¨re sans enchÃ©risseur : la case reste Ã  la banque", () => {
    const s = place(makeGame(), 0, 0);
    const landed = applyAction(s, roll(1, 2));
    const declined = applyAction(landed.state, { t: "decline" });
    const a1 = applyAction(declined.state, { t: "auction-pass" });
    const a2 = applyAction(a1.state, { t: "auction-pass" });
    expect(a2.state.tiles[3]?.owner).toBeNull();
  });

  it("payer le loyer transfÃ¨re l'argent au propriÃ©taire", () => {
    let s = makeGame();
    s = forceTile(s, 3, { owner: 1 });
    s = place(s, 0, 1);
    const res = applyAction(s, roll(1, 1));
    expect(p(res.state, 0).position).toBe(3);
    expect(p(res.state, 0).money).toBe(START_MONEY - 4);
    expect(p(res.state, 1).money).toBe(START_MONEY + 4);
  });
  it("loyer supérieur aux fonds : phase dette", () => {
    let s = makeGame();
    s = forceTile(s, 3, { owner: 1, houses: 3 });
    s = place(s, 0, 1);
    s = {
      ...s,
      players: s.players.map((pl, i) => (i === 0 ? { ...pl, money: 10 } : pl)),
    };
    const res = applyAction(s, roll(1, 1));
    expect(p(res.state, 0).position).toBe(3);
    expect(res.state.phase).toBe("debt");
    expect(res.state.debt?.amount).toBe(180);
    expect(res.state.debt?.creditor).toBe(1);
  });

  it("impÃ´t sur le revenu dÃ©duit du solde", () => {
    const s = place(makeGame(), 0, 2);
    const res = applyAction(s, roll(1, 1));
    expect(p(res.state, 0).position).toBe(4);
    expect(p(res.state, 0).money).toBe(START_MONEY - 200);
  });

  it("carte tirÃ©e : phase d'affichage puis application", () => {
    const s = place(makeGame(), 0, 5);
    const res = applyAction(s, roll(1, 1));
    expect(p(res.state, 0).position).toBe(7);
    expect(res.state.phase).toBe("card");
    expect(res.state.card).not.toBeNull();
    const acked = applyAction(res.state, { t: "ack-card" });
    expect(acked.state.card).toBeNull();
    expect(p(acked.state, 0).stats.cardsDrawn).toBe(1);
  });

  it("hypothÃ¨que rapporte la moitiÃ© et bloque le loyer", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    const mortgaged = applyAction(s, { t: "mortgage", pos: 1 });
    expect(p(mortgaged.state, 0).money).toBe(START_MONEY + 30);
    expect(mortgaged.state.tiles[1]?.mortgaged).toBe(true);
    expect(rentFor(mortgaged.state, 1, 7)).toBe(0);
    expect(unmortgageCost(1)).toBe(Math.ceil(30 * 1.1));
  });

  it("construction uniforme obligatoire dans un groupe", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    s = forceTile(s, 3, { owner: 0 });
    const b1 = applyAction(s, { t: "build", pos: 1 });
    expect(b1.state.tiles[1]?.houses).toBe(1);
    expect(() => applyAction(b1.state, { t: "build", pos: 1 })).toThrow("uniforme");
    const b2 = applyAction(b1.state, { t: "build", pos: 3 });
    expect(b2.state.tiles[3]?.houses).toBe(1);
    const b3 = applyAction(b2.state, { t: "build", pos: 1 });
    expect(b3.state.tiles[1]?.houses).toBe(2);
    expect(() => applyAction(b3.state, { t: "build", pos: 1 })).toThrow("uniforme");
  });

  it("on ne peut pas construire sans le groupe complet", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    expect(() => applyAction(s, { t: "build", pos: 1 })).toThrow("Groupe incomplet");
  });

  it("l'hÃ´tel remplace 4 maisons et consomme le stock", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0, houses: 4 });
    s = forceTile(s, 3, { owner: 0, houses: 4 });
    const hotel = applyAction(s, { t: "build", pos: 1 });
    expect(hotel.state.tiles[1]?.houses).toBe(5);
    expect(hotel.state.hotelStock).toBe(HOTEL_STOCK_MAX_TEST - 1);
    expect(hotel.state.houseStock).toBe(HOUSE_STOCK_MAX_TEST + 4);
  });

  it("l'Ã©change transfÃ¨re propriÃ©tÃ©s et argent", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    s = forceTile(s, 5, { owner: 1 });
    s = { ...s, phase: "post-roll" };
    const offered = applyAction(s, {
      t: "offer-trade",
      offer: { to: 1, giveMoney: 100, giveProps: [1], takeMoney: 50, takeProps: [5] },
    });
    // Nothing moves until the other side says yes.
    expect(offered.state.tiles[1]?.owner).toBe(0);
    const traded = applyAction(offered.state, { t: "accept-trade" });
    expect(traded.state.tiles[1]?.owner).toBe(1);
    expect(traded.state.tiles[5]?.owner).toBe(0);
    expect(p(traded.state, 0).money).toBe(START_MONEY - 50);
    expect(p(traded.state, 1).money).toBe(START_MONEY + 50);
  });

  it("la faillite vers un joueur lui donne les actifs", () => {
    let s = makeGame();
    s = forceTile(s, 1, { owner: 0 });
    s = forceTile(s, 6, { owner: 0, houses: 1 });
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 10000, creditor: 1, distribute: false, after: "continue", moveSteps: 0 },
    };
    const res = applyAction(s, { t: "declare-bankruptcy" });
    expect(p(res.state, 0).bankrupt).toBe(true);
    expect(res.state.tiles[1]?.owner).toBe(1);
    expect(res.state.tiles[6]?.owner).toBe(1);
    expect(res.state.tiles[6]?.houses).toBe(0);
    expect(p(res.state, 1).money).toBe(START_MONEY + START_MONEY + 25);
  });

  it("la faillite vers la banque met les cases aux enchÃ¨res", () => {
    let s = makeGame(3);
    s = forceTile(s, 1, { owner: 0 });
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 10000, creditor: null, distribute: false, after: "continue", moveSteps: 0 },
    };
    const res = applyAction(s, { t: "declare-bankruptcy" });
    expect(p(res.state, 0).bankrupt).toBe(true);
    expect(res.state.phase).toBe("auction");
    expect(res.state.tiles[1]?.owner).toBeNull();
    // Tile 1 is on the block right now; requeueing it made every estate
    // come up for auction twice.
    expect(res.state.auction?.pos).toBe(1);
    expect(res.state.pendingAuctions).not.toContain(1);
  });

  it("victoire quand il ne reste qu'un joueur", () => {
    let s = makeGame(2);
    s = {
      ...s,
      phase: "debt",
      debt: { amount: 10000, creditor: null, distribute: false, after: "continue", moveSteps: 0 },
    };
    const res = applyAction(s, { t: "declare-bankruptcy" });
    expect(res.state.phase).toBe("game-over");
    expect(res.state.winner).toBe(1);
  });

  it("les decks contiennent bien 16 cartes chacun", () => {
    const s = makeGame();
    expect(s.decks.chance).toHaveLength(16);
    expect(s.decks.chest).toHaveLength(16);
    expect(new Set(s.decks.chance).size).toBe(16);
    expect(new Set(s.decks.chest).size).toBe(16);
  });
});

const HOUSE_STOCK_MAX_TEST = 32;
const HOTEL_STOCK_MAX_TEST = 12;
