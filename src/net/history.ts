import { standingsOf } from "../game/selectors";
import type { GameState } from "../game/types";

/**
 * The record of past online games, as `get_my_games` returns it, and the
 * questions the history screen asks of it.
 *
 * The database keeps facts — who sat where, from which turn, and the board
 * as it ended. Everything read off them here (places, the winner, who took
 * over whose chair) is worked out on the device from those facts, with the
 * same ranking the end-of-game screen prints.
 */

export type GameStatus = "playing" | "finished" | "unfinished";

/** One occupant of one chair. A chair taken over has several, oldest first. */
export interface HistorySeat {
  seat: number;
  /** `null` for a guest, and for an account that has since been deleted. */
  accountId: string | null;
  /** The name they sat under. */
  name: string;
  pawn: number;
  /** The turn they sat down on: 0 for kickoff. */
  fromTurn: number;
}

export interface HistoryGame {
  id: string;
  status: GameStatus;
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
  winner: number | null;
  /** The board as it ended; `null` while the game is still being played. */
  final: GameState | null;
  seats: HistorySeat[];
}

/** An account met at the table, as it presents itself today. */
export interface Person {
  pseudo: string;
  avatar: string | null;
}

export interface History {
  games: HistoryGame[];
  /** Keyed by account id, once each however many games they appear in. */
  people: Record<string, Person>;
}

/** A chair that changed hands during the game. */
export interface Takeover {
  seat: number;
  from: HistorySeat;
  to: HistorySeat;
}

/** Everybody who sat in one chair, first occupant first. */
export function occupantsOf(game: HistoryGame, seat: number): HistorySeat[] {
  return game.seats.filter((s) => s.seat === seat).sort((a, b) => a.fromTurn - b.fromTurn);
}

/** Whoever held the chair when the game stopped. */
export function finalOccupant(game: HistoryGame, seat: number): HistorySeat | null {
  return occupantsOf(game, seat).at(-1) ?? null;
}

/**
 * The chair this account ended the game in, or the last one it held before
 * somebody else took it over — the game is theirs either way.
 */
export function mySeat(game: HistoryGame, accountId: string): number | null {
  const mine = game.seats.filter((s) => s.accountId === accountId);
  const kept = mine.find((s) => finalOccupant(game, s.seat)?.accountId === accountId);
  return (kept ?? mine.at(-1))?.seat ?? null;
}

/** Where a chair finished, 1 for first, or `null` without a final board. */
export function placeOf(game: HistoryGame, seat: number): number | null {
  if (!game.final) return null;
  const index = standingsOf(game.final).findIndex((p) => p.id === seat);
  return index === -1 ? null : index + 1;
}

/**
 * Whether this account won. A victory belongs to whoever was sitting in the
 * winning chair at the end — not to somebody who left it halfway.
 */
export function wonBy(game: HistoryGame, accountId: string): boolean {
  if (game.status !== "finished" || game.winner === null) return false;
  return finalOccupant(game, game.winner)?.accountId === accountId;
}

/** Every chair that changed hands, in the order it happened. */
export function takeoversIn(game: HistoryGame): Takeover[] {
  const found: Takeover[] = [];
  const seats = [...new Set(game.seats.map((s) => s.seat))];
  for (const seat of seats) {
    const line = occupantsOf(game, seat);
    for (let i = 1; i < line.length; i++) {
      found.push({ seat, from: line[i - 1] as HistorySeat, to: line[i] as HistorySeat });
    }
  }
  return found.sort((a, b) => a.to.fromTurn - b.to.fromTurn);
}

/**
 * How an occupant is called in the history: an account by the pseudo it
 * has today, so renaming follows into every old game; a guest, or an account
 * since deleted, by the name they sat under.
 */
export function nameOf(occupant: HistorySeat, people: Record<string, Person>): string {
  const person = occupant.accountId ? people[occupant.accountId] : undefined;
  return person?.pseudo ?? occupant.name;
}

export function avatarOf(occupant: HistorySeat, people: Record<string, Person>): string | null {
  const person = occupant.accountId ? people[occupant.accountId] : undefined;
  return person?.avatar ?? null;
}

/** How long the game lasted, in milliseconds, once it has stopped. */
export function durationOf(game: HistoryGame): number | null {
  if (!game.endedAt) return null;
  const ms = Date.parse(game.endedAt) - Date.parse(game.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/**
 * The final board with every chair wearing the name of whoever ended in it.
 *
 * The board froze its names at kickoff and a takeover renames the chair
 * through the engine, so `final` is usually right already — but an account
 * renamed since is shown under the pseudo it has now, as everywhere else in
 * the history.
 */
export function finalBoardOf(game: HistoryGame, people: Record<string, Person>): GameState | null {
  if (!game.final) return null;
  return {
    ...game.final,
    players: game.final.players.map((p) => {
      const occupant = finalOccupant(game, p.id);
      return occupant ? { ...p, name: nameOf(occupant, people) } : p;
    }),
  };
}
