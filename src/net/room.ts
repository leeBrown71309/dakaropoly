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
});

export async function fetchRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase().from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRoom(data as RawRoom) : null;
}

export async function fetchSeats(code: string): Promise<Seat[]> {
  const { data, error } = await supabase()
    .from("room_players")
    .select("*")
    .eq("room_code", code)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as RawSeat[] | null)?.map(toSeat) ?? [];
}

/** Creates a room and seats its host first, so seat 0 is always the host. */
export async function createRoom(clientId: string, name: string, pawn: number): Promise<string> {
  const sb = supabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { error } = await sb.from("rooms").insert({ code, host_id: clientId });
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
  const seat = pawn;
  const { error } = await supabase()
    .from("room_players")
    .upsert(
      { room_code: code, client_id: clientId, seat, name, pawn, avatar: null },
      { onConflict: "room_code,client_id" },
    );
  if (error) {
    if (error.code === "23505") throw new Error("Ce pion est déjà pris");
    throw new Error(error.message);
  }
}

export async function leaveRoom(code: string, clientId: string): Promise<void> {
  await supabase().from("room_players").delete().eq("room_code", code).eq("client_id", clientId);
}

/**
 * Drops a lobby the host walked out of, rather than leaving it to sit in the
 * table for ever. Rooms with a game under way are left alone — the others may
 * still be playing, and someone will want to rejoin.
 */
export async function discardLobby(code: string): Promise<void> {
  await supabase().from("rooms").delete().eq("code", code).eq("status", "lobby");
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
  const { error } = await supabase()
    .from("rooms")
    .update({
      status: "playing",
      seed,
      state,
      version: 1,
      seat_order: seatOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);
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
  const { data, error } = await supabase()
    .from("rooms")
    .update({
      state,
      version: fromVersion + 1,
      status: state.phase === "game-over" ? "over" : "playing",
      updated_at: new Date().toISOString(),
    })
    .eq("code", code)
    .eq("version", fromVersion)
    .select("version");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
