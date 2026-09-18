import type { GameState, Player, TileState } from "./types";
import {
  BOARD,
  GROUP_MEMBERS,
  STATION_POS,
  STATION_RENTS,
  UTILITY_POS,
  tileAt,
} from "./data/board";

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

export function canBuildOn(s: GameState, player: Player, pos: number): string | null {
  const tile = tileAt(pos);
  if (tile.kind !== "street" || !tile.group) return "Pas une rue";
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return "Introuvable";
  if (st.owner !== player.id) return "Pas à vous";
  const members = GROUP_MEMBERS[tile.group];
  if (!members.every((p) => s.tiles[p]?.owner === player.id)) return "Groupe incomplet";
  if (members.some((p) => s.tiles[p]?.mortgaged)) return "Hypothèque dans le groupe";
  if (st.houses >= 5) return "Hôtel déjà construit";
  if (st.houses !== Math.min(...members.map((p) => s.tiles[p]?.houses ?? 0))) {
    return "Construction uniforme requise";
  }
  if (st.houses === 4) {
    if (s.hotelStock <= 0) return "Plus d'hôtels en banque";
  } else if (s.houseStock <= 0) {
    return "Plus de maisons en banque";
  }
  if (player.money < (tile.houseCost ?? 0)) return "Fonds insuffisants";
  return null;
}

export function canSellHouseOn(s: GameState, player: Player, pos: number): string | null {
  const tile = tileAt(pos);
  if (tile.kind !== "street" || !tile.group) return "Pas une rue";
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return "Introuvable";
  if (st.owner !== player.id) return "Pas à vous";
  if (st.houses <= 0) return "Aucun bâtiment";
  const members = GROUP_MEMBERS[tile.group];
  if (st.houses !== Math.max(...members.map((p) => s.tiles[p]?.houses ?? 0))) {
    return "Vente uniforme requise";
  }
  if (st.houses === 5 && s.houseStock < 4) return "Banque sans maisons";
  return null;
}

export function canMortgage(s: GameState, player: Player, pos: number): string | null {
  const tile = tileAt(pos);
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return "Introuvable";
  if (st.owner !== player.id) return "Pas à vous";
  if (st.mortgaged) return "Déjà hypothéquée";
  if (tile.group) {
    const members = GROUP_MEMBERS[tile.group];
    if (members.some((p) => (s.tiles[p]?.houses ?? 0) > 0)) {
      return "Vendez d'abord les bâtiments du groupe";
    }
  }
  return null;
}

export function unmortgageCost(pos: number): number {
  const tile = tileAt(pos);
  return Math.ceil(((tile.price ?? 0) / 2) * 1.1);
}

export function canUnmortgage(s: GameState, player: Player, pos: number): string | null {
  const st = s.tiles[pos] as TileState | undefined;
  if (!st) return "Introuvable";
  if (st.owner !== player.id) return "Pas à vous";
  if (!st.mortgaged) return "Pas hypothéquée";
  if (player.money < unmortgageCost(pos)) return "Fonds insuffisants";
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
