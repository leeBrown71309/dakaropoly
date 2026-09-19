import { formatMoney, type GameState, type Player, type TileState } from "./types";
import {
  BOARD,
  GROUP_MEMBERS,
  STATION_POS,
  STATION_RENTS,
  UTILITY_POS,
  tileAt,
} from "./data/board";
import { GROUP_NAMES } from "./colors";

/**
 * Why a move is refused: the short verdict, and the rule behind it.
 *
 * The verdict alone is what the interface used to show. "Groupe incomplet"
 * tells a player who already knows the rules what they had guessed, and a
 * player who does not, nothing at all — so every refusal now carries a
 * sentence saying what the rule is, and names the figures involved rather
 * than leaving them to be worked out from the board.
 */
export interface Blocker {
  title: string;
  detail: string;
}

const refuse = (title: string, detail: string): Blocker => ({ title, detail });

/** The one tile of a group whose buildings are the ones to touch next. */
function nameOf(pos: number | undefined, fallback: string): string {
  return pos === undefined ? fallback : tileAt(pos).name;
}

export function ownsGroup(s: GameState, playerId: number, group: keyof typeof GROUP_MEMBERS): boolean {
  return GROUP_MEMBERS[group].every((pos) => s.tiles[pos]?.owner === playerId);
}

export function rentFor(s: GameState, pos: number, diceSum: number, multiplier = 1): number {
  const tile = tileAt(pos);
  const st = s.tiles[pos] as TileState | undefined;
  if (!st || st.owner === null || st.mortgaged) return 0;
  if (tile.kind === "street" && tile.group && tile.rents) {
    if (ownsGroup(s, st.owner, tile.group) && st.houses === 0) {
      return (tile.rents[0] ?? 0) * 2 * multiplier;
    }
    return (tile.rents[st.houses] ?? 0) * multiplier;
  }
  if (tile.kind === "station") {
    const n = STATION_POS.filter((p) => s.tiles[p]?.owner === st.owner).length;
    return (STATION_RENTS[Math.max(n, 1) - 1] ?? 0) * multiplier;
  }
  if (tile.kind === "utility") {
    const n = UTILITY_POS.filter((p) => s.tiles[p]?.owner === st.owner).length;
    return (n === 2 ? 10 : 4) * diceSum * multiplier;
  }
  return 0;
}

/**
 * Which line of a title deed this property earns on, for whoever holds it.
 *
 * Only meaningful once it *is* held, which is the case the patrimoine panel
 * shows. On a square nobody owns there is no such line.
 */
export function rentRow(s: GameState, pos: number): number | undefined {
  const tile = tileAt(pos);
  const owner = s.tiles[pos]?.owner;
  if (owner === undefined || owner === null) return undefined;
  if (tile.kind === "street") return s.tiles[pos]?.houses ?? 0;
  if (tile.kind === "station") {
    return STATION_POS.filter((p) => s.tiles[p]?.owner === owner).length - 1;
  }
  if (tile.kind === "utility") {
    return UTILITY_POS.filter((p) => s.tiles[p]?.owner === owner).length === 2 ? 1 : 0;
  }
  return undefined;
}

/**
 * Which line a player already stands on, before buying anything.
 *
 * Every line of the register is a claim about a number held — "2 gares
 * possédées" — so marking one is saying you hold that many. On a square
 * nobody owns, the line the purchase *would* reach is a claim about a
 * purchase not yet made, and marking it says you already own a station you
 * are still deciding whether to buy. What is true, and is the thing worth
 * knowing before paying, is where you stand now: the line below it is what
 * this square would move you to.
 *
 * A player holding none of the family stands on no line at all, and a street
 * has no family to stand in — both get nothing marked, because there is
 * nothing true to mark.
 */
export function holdingRow(s: GameState, pos: number, playerId: number): number | undefined {
  const tile = tileAt(pos);
  if (tile.kind === "station") {
    const held = STATION_POS.filter((p) => s.tiles[p]?.owner === playerId).length;
    return held > 0 ? held - 1 : undefined;
  }
  if (tile.kind === "utility") {
    const held = UTILITY_POS.filter((p) => s.tiles[p]?.owner === playerId).length;
    return held > 0 ? held - 1 : undefined;
  }
  return undefined;
}

export function canBuildOn(s: GameState, player: Player, pos: number): Blocker | null {
  const tile = tileAt(pos);
  if (tile.kind !== "street" || !tile.group) {
    return refuse(
      "Pas une rue",
      "Seules les rues se construisent : les gares et les services publics n'accueillent ni maison ni hôtel.",
    );
  }
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return refuse("Introuvable", "Cette case n'existe pas sur le plateau.");
  if (st.owner !== player.id) return refuse("Pas à vous", "On ne bâtit que sur ses propres rues.");
  const members = GROUP_MEMBERS[tile.group];
  const mine = members.filter((p) => s.tiles[p]?.owner === player.id).length;
  if (mine < members.length) {
    return refuse(
      "Groupe incomplet",
      `Bâtir demande la couleur entière : les ${members.length} rues ${GROUP_NAMES[tile.group].toLowerCase()}. Vous en avez ${mine}.`,
    );
  }
  if (members.some((p) => s.tiles[p]?.mortgaged)) {
    return refuse(
      "Hypothèque dans le groupe",
      "Une seule rue hypothéquée gèle toute la couleur. Levez l'hypothèque avant de bâtir.",
    );
  }
  if (st.houses >= 5) {
    return refuse("Hôtel déjà construit", "L'hôtel est le dernier échelon : cette rue ne peut plus monter.");
  }
  const lowest = Math.min(...members.map((p) => s.tiles[p]?.houses ?? 0));
  if (st.houses !== lowest) {
    const behind = members.find((p) => (s.tiles[p]?.houses ?? 0) === lowest);
    return refuse(
      "Construction uniforme requise",
      `On bâtit à niveau égal dans une couleur : aucune rue ne prend plus d'une maison d'avance. Commencez par ${nameOf(behind, "la rue la moins construite")}.`,
    );
  }
  if (st.houses === 4) {
    if (s.hotelStock <= 0) {
      return refuse(
        "Plus d'hôtels en banque",
        "Les 12 hôtels sont déjà sur le plateau. Il faudra qu'un joueur en revende un.",
      );
    }
  } else if (s.houseStock <= 0) {
    return refuse(
      "Plus de maisons en banque",
      "Les 32 maisons sont déjà sur le plateau. Il faudra qu'un joueur en revende avant que vous puissiez bâtir.",
    );
  }
  const cost = tile.houseCost ?? 0;
  if (player.money < cost) {
    return refuse(
      "Fonds insuffisants",
      `Bâtir ici coûte ${formatMoney(cost)} ; il vous manque ${formatMoney(cost - player.money)}.`,
    );
  }
  return null;
}

export function canSellHouseOn(s: GameState, player: Player, pos: number): Blocker | null {
  const tile = tileAt(pos);
  if (tile.kind !== "street" || !tile.group) {
    return refuse("Pas une rue", "Seules les rues portent des bâtiments.");
  }
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return refuse("Introuvable", "Cette case n'existe pas sur le plateau.");
  if (st.owner !== player.id) return refuse("Pas à vous", "On ne revend que ses propres bâtiments.");
  if (st.houses <= 0) return refuse("Aucun bâtiment", "Il n'y a rien à revendre sur cette rue.");
  const members = GROUP_MEMBERS[tile.group];
  const highest = Math.max(...members.map((p) => s.tiles[p]?.houses ?? 0));
  if (st.houses !== highest) {
    const ahead = members.find((p) => (s.tiles[p]?.houses ?? 0) === highest);
    return refuse(
      "Vente uniforme requise",
      `On revend à niveau égal, comme on bâtit : commencez par ${nameOf(ahead, "la rue la plus construite")}.`,
    );
  }
  if (st.houses === 5 && s.houseStock < 4) {
    return refuse(
      "Banque sans maisons",
      `Un hôtel se reprend contre les 4 maisons qu'il remplace, et la banque n'en a que ${s.houseStock}.`,
    );
  }
  return null;
}

export function canMortgage(s: GameState, player: Player, pos: number): Blocker | null {
  const tile = tileAt(pos);
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return refuse("Introuvable", "Cette case n'existe pas sur le plateau.");
  if (st.owner !== player.id) return refuse("Pas à vous", "On n'hypothèque que ses propres biens.");
  if (st.mortgaged) {
    return refuse(
      "Déjà hypothéquée",
      "Ce bien est déjà gagé : il ne rapporte plus rien tant que l'hypothèque n'est pas levée.",
    );
  }
  if (tile.group) {
    const members = GROUP_MEMBERS[tile.group];
    if (members.some((p) => (s.tiles[p]?.houses ?? 0) > 0)) {
      return refuse(
        "Bâtiments sur la couleur",
        `Une couleur ne s'hypothèque pas tant qu'elle porte des bâtiments. Revendez d'abord ceux de la couleur ${GROUP_NAMES[tile.group].toLowerCase()}.`,
      );
    }
  }
  return null;
}

export function unmortgageCost(pos: number): number {
  const tile = tileAt(pos);
  return Math.ceil(((tile.price ?? 0) / 2) * 1.1);
}

export function canUnmortgage(s: GameState, player: Player, pos: number): Blocker | null {
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return refuse("Introuvable", "Cette case n'existe pas sur le plateau.");
  if (st.owner !== player.id) return refuse("Pas à vous", "On ne lève que ses propres hypothèques.");
  if (!st.mortgaged) return refuse("Pas hypothéquée", "Ce bien n'est pas gagé : il rapporte déjà son loyer.");
  const cost = unmortgageCost(pos);
  if (player.money < cost) {
    return refuse(
      "Fonds insuffisants",
      `Lever l'hypothèque coûte ${formatMoney(cost)} — la moitié du prix, plus 10 % d'intérêt. Il vous manque ${formatMoney(cost - player.money)}.`,
    );
  }
  return null;
}

export function mortgageValue(pos: number): number {
  const tile = tileAt(pos);
  return Math.floor((tile.price ?? 0) / 2);
}

export function houseRefund(pos: number): number {
  const tile = tileAt(pos);
  return Math.floor((tile.houseCost ?? 0) / 2);
}

export function netWorthOf(s: GameState, player: Player): number {
  let total = player.money;
  BOARD.forEach((tile, pos) => {
    const st = s.tiles[pos] as TileState | undefined;
    if (!st || st.owner !== player.id) return;
    if (tile.kind === "street") {
      total += st.houses * (tile.houseCost ?? 0);
    }
    total += st.mortgaged ? Math.floor((tile.price ?? 0) / 2) : tile.price ?? 0;
  });
  return total;
}

export function ownedPositions(s: GameState, playerId: number): number[] {
  return BOARD.map((_, pos) => pos).filter((pos) => s.tiles[pos]?.owner === playerId);
}

/**
 * The one player entitled to act right now, or `null` when the game is over.
 *
 * It is *not* always `s.current`: during an auction the floor belongs to the
 * head of the rotating bidding queue, and everyone else — the player whose
 * turn it nominally is included — must wait. Online, this is what decides
 * whose device shows buttons, so every gate reads it rather than comparing
 * against `current` by hand.
 */
export function actorFor(s: GameState): number | null {
  if (s.phase === "game-over") return null;
  if (s.phase === "auction" && s.auction) return s.auction.order[0] ?? null;
  return s.current;
}

/**
 * Whether a device is entitled to play right now.
 *
 * Hot-seat, one device speaks for whoever is to move, so the answer is always
 * yes. Online, only the device holding the legal actor's seat — and a
 * spectator holds no seat at all, so never. Those two `null`s mean opposite
 * things, which is exactly why `online` is passed rather than inferred.
 */
export function mayAct(s: GameState, online: boolean, localPlayerId: number | null): boolean {
  if (!online) return true;
  return localPlayerId !== null && actorFor(s) === localPlayerId;
}

/** What an offer on the table asks of this device, if anything. */
export type TradeRole = "answer" | "await" | null;

/**
 * Where this device stands in a pending trade.
 *
 * `answer` puts Accepter and Refuser on screen, `await` the offer and a way
 * to take it back. Everyone else gets neither: a trade between two other
 * players is their business, and a modal over the board would be rude.
 *
 * Hot-seat always answers. One screen means the device is passed, or leaned
 * over, and the person being offered the deal is standing right there.
 */
export function tradeRoleFor(
  s: GameState,
  online: boolean,
  localPlayerId: number | null,
): TradeRole {
  const pending = s.pendingTrade;
  if (!pending) return null;
  if (!online) return "answer";
  if (localPlayerId === pending.offer.to) return "answer";
  if (localPlayerId === pending.from) return "await";
  return null;
}
