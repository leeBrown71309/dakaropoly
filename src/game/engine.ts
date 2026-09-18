import type {
  Action,
  ApplyResult,
  GameEvent,
  GameState,
  Player,
  PhaseKind,
  TileState,
  TradeOffer,
} from "./types";
import { BOARD, GROUP_MEMBERS, STATION_POS, UTILITY_POS, tileAt } from "./data/board";
import { CARDS_BY_ID, DECK_IDS } from "./data/cards";
import { PLAYER_COLORS } from "./data/pawns";
import { mortgageValue, ownedPositions, rentFor } from "./selectors";

export const START_MONEY = 1500;
export const SALARY = 200;
export const JAIL_FINE = 50;
export const HOUSE_STOCK_MAX = 32;
export const HOTEL_STOCK_MAX = 12;

export function createGame(
  defs: { name: string; pawn: number }[],
  seed: number = Math.floor(Math.random() * 2147483647),
): GameState {
  const state: GameState = {
    phase: "turn-start",
    buyTile: null,
    auction: null,
    debt: null,
    card: null,
    players: defs.map((d, i) => ({
      id: i,
      name: d.name,
      pawn: d.pawn,
      color: PLAYER_COLORS[d.pawn] as string,
      money: START_MONEY,
      position: 0,
      inJail: false,
      jailAttempts: 0,
      getOutCards: 0,
      bankrupt: false,
      stats: {
        rentsCollected: 0,
        rentPaid: 0,
        jailVisits: 0,
        cardsDrawn: 0,
        doublesRolled: 0,
        purchases: 0,
      },
    })),
    current: 0,
    tiles: BOARD.map(() => ({ owner: null, houses: 0, mortgaged: false })),
    houseStock: HOUSE_STOCK_MAX,
    hotelStock: HOTEL_STOCK_MAX,
    lastRoll: null,
    lastRollDouble: false,
    doublesCount: 0,
    turnCount: 1,
    winner: null,
    pendingAuctions: [],
    turnEnded: false,
    decks: { chance: [], chest: [] },
    discards: { chance: [], chest: [] },
    rng: seed,
    log: ["La partie commence à Dakar !"],
  };
  state.decks.chance = shuffled(state, DECK_IDS.chance);
  state.decks.chest = shuffled(state, DECK_IDS.chest);
  return state;
}

function nextRng(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function d6(s: GameState): number {
  return 1 + Math.floor(nextRng(s) * 6);
}

function shuffled(s: GameState, list: string[]): string[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRng(s) * (i + 1));
    const a = arr[i] as string;
    const b = arr[j] as string;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

function addLog(s: GameState, text: string): void {
  s.log.push(text);
  if (s.log.length > 200) s.log.shift();
}

function assertPhase(s: GameState, kind: PhaseKind): void {
  if (s.phase !== kind) throw new Error("Action impossible maintenant");
}

function assertManageable(s: GameState): void {
  if (s.phase !== "turn-start" && s.phase !== "post-roll" && s.phase !== "buy-decision") {
    throw new Error("Gestion impossible maintenant");
  }
}

function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.bankrupt);
}

function payOrDebt(
  s: GameState,
  events: GameEvent[],
  player: Player,
  amount: number,
  creditor: Player | null,
  distribute = false,
): void {
  if (amount <= 0) return;
  if (player.money >= amount) {
    player.money -= amount;
    events.push({ t: "money", player: player.id, amount: -amount });
    if (creditor) {
      creditor.money += amount;
      creditor.stats.rentsCollected += amount;
      events.push({ t: "money", player: creditor.id, amount });
    } else if (distribute) {
      const others = activePlayers(s).filter((p) => p.id !== player.id);
      const share = Math.floor(amount / Math.max(others.length, 1));
      for (const o of others) {
        o.money += share;
        events.push({ t: "money", player: o.id, amount: share });
      }
    }
    return;
  }
  s.phase = "debt";
  s.debt = {
    amount,
    creditor: creditor ? creditor.id : null,
    distribute,
    after: "continue",
    moveSteps: 0,
  };
}

function sendToJail(s: GameState, events: GameEvent[], player: Player): void {
  player.position = 10;
  player.inJail = true;
  player.jailAttempts = 0;
  player.stats.jailVisits += 1;
  s.turnEnded = true;
  events.push({ t: "jail-in", player: player.id });
}

function freeJail(
  s: GameState,
  events: GameEvent[],
  player: Player,
  reason: "fine" | "card" | "doubles",
): void {
  player.inJail = false;
  player.jailAttempts = 0;
  s.lastRollDouble = false;
  s.doublesCount = 0;
  events.push({ t: "jail-out", player: player.id, reason });
}

function rollDice(s: GameState, events: GameEvent[], player: Player, forced?: { a: number; b: number }): void {
  s.phase = "resolving";
  const a = forced?.a ?? d6(s);
  const b = forced?.b ?? d6(s);
  s.lastRoll = { a, b };
  s.lastRollDouble = a === b;
  events.push({ t: "roll-dice", a, b });

  if (player.inJail) {
    if (a === b) {
      freeJail(s, events, player, "doubles");
      walkAndResolve(s, events, player, a + b, a + b);
      return;
    }
    player.jailAttempts += 1;
    if (player.jailAttempts >= 3) {
      addLog(s, `${player.name} échoue 3 fois : il paie ${JAIL_FINE} F et sort`);
      if (player.money >= JAIL_FINE) {
        player.money -= JAIL_FINE;
        events.push({ t: "money", player: player.id, amount: -JAIL_FINE });
        freeJail(s, events, player, "fine");
        walkAndResolve(s, events, player, a + b, a + b);
      } else {
        s.phase = "debt";
        s.debt = {
          amount: JAIL_FINE,
          creditor: null,
          distribute: false,
          after: "release-move",
          moveSteps: a + b,
        };
      }
      return;
    }
    events.push({
      t: "toast",
      text: `${player.name} ne fait pas de double et reste en prison (${player.jailAttempts}/3)`,
      tone: "bad",
    });
    endTurn(s, events);
    return;
  }

  if (a === b) {
    player.stats.doublesRolled += 1;
    s.doublesCount += 1;
    if (s.doublesCount >= 3) {
      s.doublesCount = 0;
      events.push({ t: "toast", text: "3 doubles d'affilée : direction Rebeuss !", tone: "bad" });
      sendToJail(s, events, player);
      endTurn(s, events);
      return;
    }
    walkAndResolve(s, events, player, a + b, a + b);
    return;
  }
  s.doublesCount = 0;
  walkAndResolve(s, events, player, a + b, a + b);
}

function rollSumOf(s: GameState): number {
  if (!s.lastRoll) return 7;
  return s.lastRoll.a + s.lastRoll.b;
}

function walkAndResolve(s: GameState, events: GameEvent[], player: Player, steps: number, rollSum: number): void {
  events.push({ t: "move-steps", player: player.id, steps });
  const total = player.position + steps;
  if (total >= 40) {
    player.money += SALARY;
    events.push({ t: "money", player: player.id, amount: SALARY });
    events.push({ t: "toast", text: `${player.name} passe par le Départ (+200 F)`, tone: "good" });
  }
  player.position = ((total % 40) + 40) % 40;
  if (steps > 0 && player.position === 0) {
    player.money += SALARY;
    events.push({ t: "money", player: player.id, amount: SALARY });
    events.push({ t: "toast", text: "Pile sur le Départ : double salaire (+200 F) !", tone: "good" });
  }
  resolveTile(s, events, rollSum);
  if (s.phase === "resolving") finishResolution(s, events);
}

function moveTo(s: GameState, events: GameEvent[], player: Player, pos: number, rollSum: number): void {
  if (pos < player.position) {
    player.money += SALARY;
    events.push({ t: "money", player: player.id, amount: SALARY });
    events.push({ t: "toast", text: `${player.name} passe par le Départ (+200 F)`, tone: "good" });
  }
  player.position = pos;
  events.push({ t: "teleport", player: player.id, pos });
  resolveTile(s, events, rollSum);
}

function resolveTile(s: GameState, events: GameEvent[], rollSum: number): void {
  const player = s.players[s.current] as Player;
  const tile = tileAt(player.position);
  switch (tile.kind) {
    case "street":
    case "station":
    case "utility": {
      const st = s.tiles[player.position] as TileState;
      if (st.owner === null) {
        s.buyTile = player.position;
        s.phase = "buy-decision";
        return;
      }
      if (st.owner === player.id) {
        events.push({ t: "toast", text: `${tile.name} vous appartient déjà`, tone: "info" });
        return;
      }
      if (st.mortgaged) {
        events.push({ t: "toast", text: `${tile.name} est hypothéquée : pas de loyer`, tone: "info" });
        return;
      }
      const owner = s.players[st.owner] as Player;
      const rent = rentFor(s, player.position, rollSum);
      events.push({
        t: "toast",
        text: `${player.name} paie ${rent} F de loyer à ${owner.name}`,
        tone: "bad",
      });
      payOrDebt(s, events, player, rent, owner);
      return;
    }
    case "tax": {
      events.push({ t: "toast", text: `${tile.name} : payez ${tile.taxAmount} F`, tone: "bad" });
      payOrDebt(s, events, player, tile.taxAmount ?? 0, null);
      return;
    }
    case "chance":
    case "chest": {
      drawCard(s, events, tile.kind);
      return;
    }
    case "goto-jail": {
      sendToJail(s, events, player);
      return;
    }
    default:
      return;
  }
}

function finishResolution(s: GameState, events: GameEvent[]): void {
  if (s.turnEnded) {
    endTurn(s, events);
    return;
  }
  if (s.lastRollDouble) {
    s.phase = "turn-start";
    events.push({ t: "toast", text: "Double ! Vous rejouez.", tone: "good" });
    return;
  }
  s.phase = "post-roll";
}

function endTurn(s: GameState, events: GameEvent[]): void {
  const active = activePlayers(s);
  if (active.length <= 1) {
    s.phase = "game-over";
    s.winner = active.length === 1 ? ((active[0] as Player).id as number) : null;
    if (s.winner !== null) events.push({ t: "winner", player: s.winner });
    return;
  }
  let idx = s.current;
  for (;;) {
    idx = (idx + 1) % s.players.length;
    if (!s.players[idx]?.bankrupt) break;
  }
  s.current = idx;
  s.turnCount += 1;
  s.phase = "turn-start";
  s.turnEnded = false;
  s.lastRoll = null;
  s.lastRollDouble = false;
  s.doublesCount = 0;
  events.push({ t: "turn", player: idx });
}

function startAuction(s: GameState, events: GameEvent[], pos: number): void {
  const order: number[] = [];
  for (let i = 1; i <= s.players.length; i++) {
    const p = s.players[(s.current + i) % s.players.length] as Player;
    if (!p.bankrupt) order.push(p.id);
  }
  s.auction = { pos, order, highBid: 0, highBidder: null };
  s.phase = "auction";
  events.push({ t: "auction-start", pos, participants: order });
}

function resolveAuction(s: GameState, events: GameEvent[]): void {
  const a = s.auction;
  if (!a) return;
  const tile = tileAt(a.pos);
  if (a.highBidder !== null && a.highBid > 0) {
    const winner = s.players[a.highBidder] as Player;
    winner.money -= a.highBid;
    (s.tiles[a.pos] as TileState).owner = winner.id;
    winner.stats.purchases += 1;
    events.push({ t: "auction-end", player: winner.id, pos: a.pos, price: a.highBid });
    events.push({
      t: "toast",
      text: `${winner.name} remporte ${tile.name} aux enchères pour ${a.highBid} F`,
      tone: "good",
    });
  } else {
    events.push({ t: "auction-end", player: null, pos: a.pos, price: 0 });
    events.push({
      t: "toast",
      text: `Personne n'enchérit : ${tileAt(a.pos).name} reste à la banque`,
      tone: "info",
    });
  }
  s.auction = null;
}

function afterAuction(s: GameState, events: GameEvent[]): void {
  const nextPos = s.pendingAuctions.shift();
  if (nextPos !== undefined) {
    startAuction(s, events, nextPos);
    return;
  }
  finishResolution(s, events);
}

function transferAssets(s: GameState, events: GameEvent[], debtor: Player, creditorId: number | null): void {
  const creditor = creditorId !== null ? (s.players[creditorId] as Player) : null;
  if (creditor && debtor.money > 0) {
    creditor.money += debtor.money;
    events.push({ t: "money", player: creditor.id, amount: debtor.money });
  }
  debtor.money = 0;
  BOARD.forEach((tile, pos) => {
    const st = s.tiles[pos] as TileState;
    if (st.owner !== debtor.id) return;
    if (tile.kind === "street" && st.houses > 0) {
      const refund = st.houses * Math.floor((tile.houseCost ?? 0) / 2);
      st.houses = 0;
      if (creditor && refund > 0) {
        creditor.money += refund;
        events.push({ t: "money", player: creditor.id, amount: refund });
      }
    }
    if (creditor) {
      st.owner = creditor.id;
      events.push({ t: "transfer", from: debtor.id, to: creditor.id, pos });
      if (st.mortgaged) {
        const fee = Math.ceil(mortgageValue(pos) * 0.1);
        creditor.money = Math.max(creditor.money - fee, 0);
      }
    } else {
      st.owner = null;
      st.mortgaged = false;
    }
  });
  debtor.bankrupt = true;
  events.push({ t: "toast", text: `${debtor.name} fait faillite !`, tone: "bad" });
}

function validateTrade(s: GameState, player: Player, offer: TradeOffer): void {
  if (offer.to === player.id) throw new Error("Échange avec soi-même ?");
  const target = s.players[offer.to] as Player;
  if (target.bankrupt) throw new Error("Ce joueur est éliminé");
  if (offer.giveMoney > player.money) throw new Error("Fonds insuffisants");
  if (offer.takeMoney > target.money) throw new Error(`${target.name} n'a pas assez de fonds`);
  for (const pos of offer.giveProps) {
    const st = s.tiles[pos] as TileState;
    if (st.owner !== player.id) throw new Error("Propriété qui n'est pas à vous");
    if (st.houses > 0) throw new Error("Vendez les bâtiments avant l'échange");
  }
  for (const pos of offer.takeProps) {
    const st = s.tiles[pos] as TileState;
    if (st.owner !== offer.to) throw new Error("Propriété pas à ce joueur");
    if (st.houses > 0) throw new Error("Bâtiments à vendre avant l'échange");
  }
}

function drawCard(s: GameState, events: GameEvent[], deck: "chance" | "chest"): void {
  if (s.decks[deck].length === 0) {
    s.decks[deck] = shuffled(s, s.discards[deck]);
    s.discards[deck] = [];
  }
  const cardId = s.decks[deck].shift() as string;
  (s.players[s.current] as Player).stats.cardsDrawn += 1;
  events.push({ t: "show-card", deck, cardId });
  s.card = { deck, cardId };
  s.phase = "card";
}

function applyCardEffect(s: GameState, events: GameEvent[], cardId: string): void {
  const card = CARDS_BY_ID[cardId];
  if (!card) throw new Error("Carte inconnue");
  const player = s.players[s.current] as Player;
  const effect = card.effect;
  switch (effect.k) {
    case "money": {
      if (effect.amount >= 0) {
        player.money += effect.amount;
        events.push({ t: "money", player: player.id, amount: effect.amount });
        events.push({ t: "toast", text: `${player.name} reçoit ${effect.amount} F`, tone: "good" });
      } else {
        events.push({ t: "toast", text: card.text, tone: "bad" });
        payOrDebt(s, events, player, -effect.amount, null);
      }
      break;
    }
    case "collect-each": {
      const others = activePlayers(s).filter((p) => p.id !== player.id);
      let total = 0;
      for (const o of others) {
        const amt = Math.min(o.money, effect.amount);
        if (amt > 0) {
          o.money -= amt;
          total += amt;
          events.push({ t: "money", player: o.id, amount: -amt });
        }
      }
      player.money += total;
      events.push({ t: "money", player: player.id, amount: total });
      events.push({ t: "toast", text: card.text, tone: "good" });
      break;
    }
    case "pay-each": {
      const others = activePlayers(s).filter((p) => p.id !== player.id);
      if (others.length === 0) break;
      events.push({ t: "toast", text: card.text, tone: "bad" });
      payOrDebt(s, events, player, effect.amount * others.length, null);
      break;
    }
    case "move": {
      moveTo(s, events, player, effect.pos, 0);
      break;
    }
    case "move-back": {
      events.push({ t: "move-steps", player: player.id, steps: -effect.steps });
      const total = player.position - effect.steps;
      player.position = ((total % 40) + 40) % 40;
      resolveTile(s, events, rollSumOf(s));
      break;
    }
    case "go-to-jail": {
      sendToJail(s, events, player);
      break;
    }
    case "nearest-station": {
      const target = nextOfKind(player.position, STATION_POS);
      player.position = target;
      events.push({ t: "teleport", player: player.id, pos: target });
      const st = s.tiles[target] as TileState;
      if (st.owner === null) {
        s.buyTile = target;
        s.phase = "buy-decision";
        return;
      }
      if (st.owner === player.id) {
        events.push({ t: "toast", text: "Votre propre gare : rien à payer", tone: "info" });
        break;
      }
      if (st.mortgaged) {
        events.push({ t: "toast", text: "Gare hypothéquée : rien à payer", tone: "info" });
        break;
      }
      const owner = s.players[st.owner] as Player;
      const rent = rentFor(s, target, 0, 2);
      events.push({
        t: "toast",
        text: `${player.name} paie le double du loyer (${rent} F) à ${owner.name}`,
        tone: "bad",
      });
      payOrDebt(s, events, player, rent, owner);
      break;
    }
    case "nearest-utility": {
      const target = nextOfKind(player.position, UTILITY_POS);
      player.position = target;
      events.push({ t: "teleport", player: player.id, pos: target });
      const st = s.tiles[target] as TileState;
      if (st.owner === null) {
        s.buyTile = target;
        s.phase = "buy-decision";
        return;
      }
      if (st.owner === player.id) {
        events.push({ t: "toast", text: "Votre propre service : rien à payer", tone: "info" });
        break;
      }
      if (st.mortgaged) {
        events.push({ t: "toast", text: "Service hypothéquée : rien à payer", tone: "info" });
        break;
      }
      const a = d6(s);
      const b = d6(s);
      s.lastRoll = { a, b };
      events.push({ t: "roll-dice", a, b });
      const owner = s.players[st.owner] as Player;
      const rent = 10 * (a + b);
      events.push({
        t: "toast",
        text: `${player.name} paie 10 × ${a + b} = ${rent} F à ${owner.name}`,
        tone: "bad",
      });
      payOrDebt(s, events, player, rent, owner);
      break;
    }
    case "repairs": {
      let cost = 0;
      BOARD.forEach((tile, pos) => {
        const st = s.tiles[pos] as TileState;
        if (st.owner !== player.id || tile.kind !== "street") return;
        cost += st.houses === 5 ? effect.hotel : st.houses * effect.house;
      });
      if (cost <= 0) {
        events.push({ t: "toast", text: "Aucun bâtiment : rien à payer", tone: "info" });
        break;
      }
      events.push({ t: "toast", text: `${card.title} : ${cost} F`, tone: "bad" });
      payOrDebt(s, events, player, cost, null);
      break;
    }
    case "jail-free": {
      player.getOutCards += 1;
      events.push({
        t: "toast",
        text: `${player.name} obtient une carte Sortie de prison`,
        tone: "good",
      });
      break;
    }
  }
}

export function applyAction(prev: GameState, action: Action): ApplyResult {
  const s: GameState = {
    ...prev,
    players: prev.players.map((p) => ({ ...p, stats: { ...p.stats } })),
    tiles: prev.tiles.map((t) => ({ ...t })),
    decks: { chance: [...prev.decks.chance], chest: [...prev.decks.chest] },
    discards: { chance: [...prev.discards.chance], chest: [...prev.discards.chest] },
    lastRoll: prev.lastRoll ? { ...prev.lastRoll } : null,
    log: [...prev.log],
    pendingAuctions: [...prev.pendingAuctions],
  };
  const events: GameEvent[] = [];
  const player = s.players[s.current] as Player;

  switch (action.t) {
    case "roll": {
      assertPhase(s, "turn-start");
      rollDice(s, events, player, action.forced);
      break;
    }
    case "ack-card": {
      assertPhase(s, "card");
      const cardId = (s.card as NonNullable<GameState["card"]>).cardId;
      s.card = null;
      s.phase = "resolving";
      applyCardEffect(s, events, cardId);
      if (s.phase === "resolving") finishResolution(s, events);
      break;
    }
    case "buy": {
      assertPhase(s, "buy-decision");
      const pos = s.buyTile as number;
      const tile = tileAt(pos);
      const price = tile.price ?? 0;
      if (player.money < price) throw new Error("Fonds insuffisants");
      player.money -= price;
      (s.tiles[pos] as TileState).owner = player.id;
      player.stats.purchases += 1;
      s.buyTile = null;
      events.push({ t: "buy", player: player.id, pos, price });
      events.push({ t: "toast", text: `${player.name} achète ${tile.name} pour ${price} F`, tone: "good" });
      s.phase = "resolving";
      finishResolution(s, events);
      break;
    }
    case "decline": {
      assertPhase(s, "buy-decision");
      const pos = s.buyTile as number;
      s.buyTile = null;
      startAuction(s, events, pos);
      break;
    }
    case "bid": {
      assertPhase(s, "auction");
      const a = s.auction as NonNullable<GameState["auction"]>;
      const bidderId = a.order[0] as number;
      const bidder = s.players[bidderId] as Player;
      if (action.amount > bidder.money) throw new Error("Fonds insuffisants");
      if (action.amount <= a.highBid) throw new Error("Enchère trop basse");
      a.highBid = action.amount;
      a.highBidder = bidderId;
      a.order = [...(a.order.slice(1) as number[]), bidderId];
      addLog(s, `${bidder.name} enchérit à ${action.amount} F`);
      if (a.order.length === 1 && a.highBidder === a.order[0]) {
        resolveAuction(s, events);
        afterAuction(s, events);
      }
      break;
    }
    case "auction-pass": {
      assertPhase(s, "auction");
      const a = s.auction as NonNullable<GameState["auction"]>;
      const passerId = a.order[0] as number;
      a.order = a.order.slice(1) as number[];
      addLog(
        s,
        `${(s.players[passerId] as Player | undefined)?.name ?? "Un joueur"} passe son tour d'enchère`,
      );
      if (a.order.length === 0) {
        resolveAuction(s, events);
        afterAuction(s, events);
      } else if (a.order.length === 1 && a.highBidder === a.order[0]) {
        resolveAuction(s, events);
        afterAuction(s, events);
      }
      break;
    }
    case "end-turn": {
      assertPhase(s, "post-roll");
      endTurn(s, events);
      break;
    }
    case "build": {
      assertManageable(s);
      buildHouse(s, events, player, action.pos);
      break;
    }
    case "sell-house": {
      assertManageable(s);
      sellHouse(s, events, player, action.pos);
      break;
    }
    case "mortgage": {
      assertManageable(s);
      mortgageTile(s, events, player, action.pos);
      break;
    }
    case "unmortgage": {
      assertManageable(s);
      unmortgageTile(s, events, player, action.pos);
      break;
    }
    case "pay-fine": {
      assertPhase(s, "turn-start");
      if (!player.inJail) throw new Error("Vous n'êtes pas en prison");
      if (player.money < JAIL_FINE) throw new Error("Fonds insuffisants");
      player.money -= JAIL_FINE;
      events.push({ t: "money", player: player.id, amount: -JAIL_FINE });
      freeJail(s, events, player, "fine");
      break;
    }
    case "use-jail-card": {
      assertPhase(s, "turn-start");
      if (!player.inJail) throw new Error("Vous n'êtes pas en prison");
      if (player.getOutCards <= 0) throw new Error("Pas de carte Sortie de prison");
      player.getOutCards -= 1;
      freeJail(s, events, player, "card");
      break;
    }
    case "pay-debt": {
      assertPhase(s, "debt");
      const debt = s.debt as NonNullable<GameState["debt"]>;
      if (player.money < debt.amount) throw new Error("Fonds insuffisants");
      player.money -= debt.amount;
      events.push({ t: "money", player: player.id, amount: -debt.amount });
      if (debt.creditor !== null) {
        const creditor = s.players[debt.creditor] as Player;
        creditor.money += debt.amount;
        creditor.stats.rentsCollected += debt.amount;
        events.push({ t: "money", player: creditor.id, amount: debt.amount });
      } else if (debt.distribute) {
        const others = activePlayers(s).filter((p) => p.id !== player.id);
        const share = Math.floor(debt.amount / Math.max(others.length, 1));
        for (const o of others) {
          o.money += share;
          events.push({ t: "money", player: o.id, amount: share });
        }
      }
      s.debt = null;
      if (debt.after === "release-move") {
        freeJail(s, events, player, "fine");
        walkAndResolve(s, events, player, debt.moveSteps, debt.moveSteps);
      } else {
        s.phase = "resolving";
        finishResolution(s, events);
      }
      break;
    }
    case "declare-bankruptcy": {
      assertPhase(s, "debt");
      const debt = s.debt as NonNullable<GameState["debt"]>;
      s.debt = null;
      const debtorTiles = ownedPositions(s, player.id);
      transferAssets(s, events, player, debt.creditor);
      if (debt.creditor === null && debtorTiles.length > 0) {
        s.pendingAuctions = debtorTiles;
        startAuction(s, events, debtorTiles[0] as number);
        break;
      }
      endTurn(s, events);
      break;
    }
    case "propose-trade": {
      assertPhase(s, "post-roll");
      const offer = action.offer;
      validateTrade(s, player, offer);
      const target = s.players[offer.to] as Player;
      if (offer.giveMoney > 0) {
        player.money -= offer.giveMoney;
        target.money += offer.giveMoney;
        events.push({ t: "money", player: target.id, amount: offer.giveMoney });
      }
      if (offer.takeMoney > 0) {
        target.money -= offer.takeMoney;
        player.money += offer.takeMoney;
        events.push({ t: "money", player: player.id, amount: offer.takeMoney });
      }
      for (const pos of offer.giveProps) {
        (s.tiles[pos] as TileState).owner = offer.to;
        events.push({ t: "transfer", from: player.id, to: offer.to, pos });
      }
      for (const pos of offer.takeProps) {
        (s.tiles[pos] as TileState).owner = player.id;
        events.push({ t: "transfer", from: offer.to, to: player.id, pos });
      }
      addLog(s, `Échange entre ${player.name} et ${target.name} accepté`);
      break;
    }
    default:
      throw new Error("Action inconnue");
  }
  return { state: s, events };
}

function nextOfKind(from: number, positions: number[]): number {
  for (let step = 1; step <= 40; step++) {
    const pos = (from + step) % 40;
    if (positions.includes(pos)) return pos;
  }
  return positions[0] as number;
}

function buildHouse(s: GameState, events: GameEvent[], player: Player, pos: number): void {
  const tile = tileAt(pos);
  if (tile.kind !== "street" || !tile.group) throw new Error("Pas une rue");
  const st = s.tiles[pos] as TileState;
  if (st.owner !== player.id) throw new Error("Pas votre propriété");
  const members = GROUP_MEMBERS[tile.group];
  if (!members.every((p) => (s.tiles[p] as TileState).owner === player.id)) {
    throw new Error("Groupe incomplet");
  }
  if (members.some((p) => (s.tiles[p] as TileState).mortgaged)) {
    throw new Error("Hypothèque dans le groupe");
  }
  if (st.houses >= 5) throw new Error("Hôtel déjà construit");
  if (st.houses !== Math.min(...members.map((p) => (s.tiles[p] as TileState).houses))) {
    throw new Error("Construction uniforme requise");
  }
  const cost = tile.houseCost ?? 0;
  if (player.money < cost) throw new Error("Fonds insuffisants");
  if (st.houses === 4) {
    if (s.hotelStock <= 0) throw new Error("Plus d'hôtels en banque");
    s.hotelStock -= 1;
    s.houseStock += 4;
  } else {
    if (s.houseStock <= 0) throw new Error("Plus de maisons en banque");
    s.houseStock -= 1;
  }
  st.houses += 1;
  player.money -= cost;
  events.push({ t: "build", pos, houses: st.houses });
  events.push({ t: "money", player: player.id, amount: -cost });
  addLog(s, `${player.name} construit sur ${tile.name} (${cost} F)`);
}

function sellHouse(s: GameState, events: GameEvent[], player: Player, pos: number): void {
  const tile = tileAt(pos);
  if (tile.kind !== "street" || !tile.group) throw new Error("Pas une rue");
  const st = s.tiles[pos] as TileState;
  if (st.owner !== player.id) throw new Error("Pas à vous");
  if (st.houses <= 0) throw new Error("Aucun bâtiment à vendre");
  const members = GROUP_MEMBERS[tile.group];
  if (st.houses !== Math.max(...members.map((p) => (s.tiles[p] as TileState).houses))) {
    throw new Error("Vente uniforme requise");
  }
  const refund =
    st.houses === 5 ? Math.floor((tile.houseCost ?? 0) * 2.5) : Math.floor((tile.houseCost ?? 0) / 2);
  if (st.houses === 5) {
    if (s.houseStock < 4) throw new Error("La banque n'a plus assez de maisons");
    s.hotelStock += 1;
    s.houseStock -= 4;
  } else {
    s.houseStock += 1;
  }
  st.houses -= 1;
  player.money += refund;
  events.push({ t: "money", player: player.id, amount: refund });
  addLog(s, `${player.name} vend un bâtiment sur ${tile.name} (+${refund} F)`);
}

function mortgageTile(s: GameState, events: GameEvent[], player: Player, pos: number): void {
  const tile = tileAt(pos);
  const st = s.tiles[pos] as TileState;
  if (st.owner !== player.id) throw new Error("Pas à vous");
  if (st.mortgaged) throw new Error("Déjà hypothéquée");
  if (tile.group) {
    const members = GROUP_MEMBERS[tile.group];
    if (members.some((p) => (s.tiles[p] as TileState).houses > 0)) {
      throw new Error("Vendez d'abord tous les bâtiments du groupe");
    }
  }
  const value = mortgageValue(pos);
  st.mortgaged = true;
  player.money += value;
  events.push({ t: "money", player: player.id, amount: value });
  addLog(s, `${player.name} hypothèque ${tile.name} (+${value} F)`);
}

function unmortgageTile(s: GameState, events: GameEvent[], player: Player, pos: number): void {
  const st = s.tiles[pos] as TileState;
  if (st.owner !== player.id) throw new Error("Pas à vous");
  if (!st.mortgaged) throw new Error("Pas hypothéquée");
  const cost = Math.ceil(mortgageValue(pos) * 1.1);
  if (player.money < cost) throw new Error("Fonds insuffisants");
  st.mortgaged = false;
  player.money -= cost;
  events.push({ t: "money", player: player.id, amount: -cost });
  addLog(s, `${player.name} lève l'hypothèque de ${tileAt(pos).name} (${cost} F)`);
}
