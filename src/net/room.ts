import type { GameState } from "../game/types";
import { supabase } from "./supabase";

export type RoomStatus = "lobby" | "playing" | "over";

export interface RoomRow {
  code: string;
  status: RoomStatus;
  hostId: string;
  seed: number | null;
  state: GameState | null;
  version: number;
  /** Client ids in kickoff order; an index here is an engine player id. */
  seatOrder: string[];
}

export interface Seat {
  clientId: string;
  /** `null` marks a spectator: they watch and never act. */
  seat: number | null;
  name: string;
  pawn: number | null;
  avatar: string | null;
  /**
   * Nothing heard from this device for well over a minute. Computed by the
   * database, not here: a chair can be taken back once its occupant is
   * absent, so the answer must not depend on a clock a client controls.
   */
  absent: boolean;
}

/** A chair at a game already under way, offered to someone arriving late. */
export interface SeatOffer {
  seat: number;
  name: string;
  pawn: number;
  /** Free to take right now. */
  free: boolean;
  /** This device's own chair, waiting for it. */
  mine: boolean;
  /** Bankrupt: the seat exists on the board but has nothing left to play. */
  out: boolean;
}

/**
 * No O/0, no I/1/L: the code gets read aloud across a room and typed on a
 * phone keyboard, so every character has to survive both.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** `ABC123` reads far better as `ABC-123` once it is on screen. */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** Keeps only characters the alphabet can actually contain. */
export function normaliseCode(input: string): string {
  return Array.from(input.toUpperCase())
    .filter((c) => ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

export const CODE_SIZE = CODE_LENGTH;

/** The link that drops someone straight onto the join form, code filled in. */
export function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}?s=${code}`;
}

interface RawRoom {
  code: string;
  status: RoomStatus;
  host_id: string;
  seed: number | null;
  state: GameState | null;
  version: number;
  seat_order: string[] | null;
}

interface RawSeat {
  client_id: string;
  seat: number | null;
  name: string;
  pawn: number | null;
  avatar: string | null;
  absent: boolean;
}

const toRoom = (r: RawRoom): RoomRow => ({
  code: r.code,
  status: r.status,
  hostId: r.host_id,
  seed: r.seed,
  state: r.state,
  version: r.version,
  seatOrder: r.seat_order ?? [],
});

const toSeat = (r: RawSeat): Seat => ({
  clientId: r.client_id,
  seat: r.seat,
  name: r.name,
  pawn: r.pawn,
  avatar: r.avatar,
  absent: r.absent === true,
});

/**
 * Rooms cannot be read from the table directly — only through this function,
 * which demands the code. That is what keeps the code a real key: without it
 * there is no way to discover, let alone join, somebody else's game.
 */
async function loadRoom(code: string): Promise<(RawRoom & { seats: RawSeat[] }) | null> {
  const { data, error } = await supabase().rpc("get_room", { p_code: code });
  if (error) throw new Error(error.message);
  return (data as (RawRoom & { seats: RawSeat[] }) | null) ?? null;
}

export async function fetchRoom(code: string): Promise<RoomRow | null> {
  const raw = await loadRoom(code);
  return raw ? toRoom(raw) : null;
}

/** The room and its roster in one call, for the moments that need both. */
export async function fetchRoomAndSeats(
  code: string,
): Promise<{ room: RoomRow; seats: Seat[] } | null> {
  const raw = await loadRoom(code);
  if (!raw) return null;
  return { room: toRoom(raw), seats: raw.seats?.map(toSeat) ?? [] };
}

export async function fetchSeats(code: string): Promise<Seat[]> {
  const raw = await loadRoom(code);
  return raw?.seats?.map(toSeat) ?? [];
}

/**
 * Creates a room and seats its host. Creating one also sweeps rooms nobody
 * has touched in a day, so finished games do not pile up for ever.
 */
export async function createRoom(clientId: string, name: string, pawn: number): Promise<string> {
  const sb = supabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { error } = await sb.rpc("create_room", { p_code: code });
    if (error) {
      // 23505 is a duplicate key: astronomically unlikely, but cheap to retry.
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
    await claimSeat(code, clientId, name, pawn);
    return code;
  }
  throw new Error("Impossible de créer un salon");
}

/**
 * Takes a seat, or sits out as a spectator when `pawn` is null.
 *
 * A seat *is* a pawn: the two are the same index, so one unique constraint
 * keeps both unique and turn order simply follows the pawn table. Two players
 * choosing the same token at the same moment is settled by the database
 * rather than here — the loser gets a constraint violation and is told to
 * pick another, which is the one outcome that cannot go wrong.
 */
export async function claimSeat(
  code: string,
  clientId: string,
  name: string,
  pawn: number | null,
): Promise<void> {
  const { error } = await supabase().rpc("claim_seat", {
    p_code: code,
    p_client_id: clientId,
    p_name: name,
    p_pawn: pawn,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Ce pion est déjà pris");
    if (error.code === "P0002") throw new Error("Aucun salon avec ce code");
    throw new Error(error.message);
  }
}

/**
 * Reports this device as still there. A seat goes up for grabs when nothing
 * has been heard from it, so silence has to mean something: a tab that is
 * closed, a phone that is off, a player who walked away.
 */
export async function touchSeat(code: string): Promise<void> {
  await supabase().rpc("touch_seat", { p_code: code });
}

/**
 * Takes a chair back in a game already in progress — this device's own after
 * a reload, or one whose occupant has gone. The database re-checks that it is
 * free; what the interface offers is only what it believes.
 */
export async function resumeSeat(code: string, seat: number): Promise<void> {
  const { error } = await supabase().rpc("resume_seat", { p_code: code, p_seat: seat });
  if (error) {
    if (error.code === "42501") throw new Error("Cette place vient d'être reprise");
    if (error.code === "P0002") throw new Error("Aucun salon avec ce code");
    throw new Error(error.message);
  }
}

/**
 * The table as it stands, seen by someone who wants to sit down at it.
 *
 * Names and pawns come from the board rather than the roster: the engine
 * froze them when play began, and they are what everyone else is looking at.
 */
export function seatOffers(room: RoomRow, seats: Seat[], clientId: string): SeatOffer[] {
  const players = room.state?.players ?? [];
  return room.seatOrder.map((owner, seat) => {
    const holder = seats.find((s) => s.seat === seat);
    const player = players[seat];
    const mine = owner === clientId;
    return {
      seat,
      name: player?.name ?? "Joueur",
      pawn: player?.pawn ?? seat,
      mine,
      out: player?.bankrupt === true,
      free: player?.bankrupt !== true && (mine || !holder || holder.absent),
    };
  });
}

/**
 * Gives up this device's chair, and the room with it when it was an empty
 * lobby this device was hosting.
 *
 * This used to delete straight from the table, and quietly deleted nothing:
 * row level security refused it and PostgREST answered 204 with no rows
 * touched, so leaving looked like it had worked while the seat stayed held.
 * Like every other write here, it now goes through a function that takes the
 * identity from the session rather than from the request.
 */
export async function leaveRoom(code: string): Promise<void> {
  const { error } = await supabase().rpc("leave_room", { p_code: code });
  if (error) throw new Error(error.message);
}

/**
 * Opens play. The seed is fixed here so every client builds the same board,
 * and the seating is frozen because the engine numbers players by their
 * position in this list.
 */
export async function startRoom(
  code: string,
  seed: number,
  state: GameState,
  seatOrder: string[],
): Promise<void> {
  const { error } = await supabase().rpc("open_room", {
    p_code: code,
    p_seed: seed,
    p_state: state,
    p_seat_order: seatOrder,
  });
  if (error) throw new Error(error.message);
}

/** The players who will actually sit down, in the order the engine will use. */
export function seatedInOrder(seats: Seat[]): Seat[] {
  return seats.filter((s) => s.seat !== null).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
}

/**
 * Writes the snapshot, but only if nobody else has written since the one this
 * client was working from. A refused write means this device is behind and
 * should pull the room again rather than overwrite someone's turn.
 */
export async function pushSnapshot(
  code: string,
  state: GameState,
  fromVersion: number,
): Promise<boolean> {
  const { data, error } = await supabase().rpc("advance_room", {
    p_code: code,
    p_state: state,
    p_from: fromVersion,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
