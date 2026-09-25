import type { GameState } from "../game/types";
import { supabase } from "./supabase";
import type { GameStatus, History, HistoryGame, HistorySeat, Person } from "./history";

/**
 * Everything an account asks of the backend. Signing in is Supabase Auth
 * with Google; the rest are functions in `supabase/schema.sql`, which take
 * the caller from the session and never from the request.
 *
 * Every call checks the error it gets back. This backend has a history of
 * refusals that looked like successes — a policy that filtered a write to
 * nothing, answered with a 204 — and a profile that silently failed to save
 * would be the same mistake again.
 */

export interface Profile {
  pseudo: string;
  avatar: string | null;
}

/**
 * Leaves for Google and comes back to this very page, where the auth client
 * exchanges the code it is handed for a session. The page unloads on the
 * way out, so nothing after this call runs.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}${location.pathname}`,
      // Google otherwise signs straight back into whichever account the
      // browser already uses — which on a shared computer is somebody else.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(`Connexion à Google impossible : ${error.message}`);
}

/**
 * Makes this tab a guest, leaving the account signed in everywhere else.
 *
 * A fresh tab reads the browser's account, so a second person opening an
 * invitation on the same computer arrived as the first. The anonymous
 * session lands in the tab (see `authStorage`), which is read first.
 */
export async function playAsGuestHere(): Promise<void> {
  const { error } = await supabase().auth.signInAnonymously();
  if (error) throw new Error(`Impossible de passer en invité : ${error.message}`);
}

/** Signs this browser out. The next room it enters, it enters as a guest. */
export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut({ scope: "local" });
  if (error) throw new Error(`Déconnexion impossible : ${error.message}`);
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase().rpc("get_my_profile");
  if (error) throw new Error(error.message);
  const raw = data as { pseudo?: unknown; avatar?: unknown } | null;
  if (!raw || typeof raw.pseudo !== "string") return null;
  return { pseudo: raw.pseudo, avatar: typeof raw.avatar === "string" ? raw.avatar : null };
}

/** Advice for the form while typing; `saveProfile` is what settles it. */
export async function isPseudoAvailable(pseudo: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("pseudo_available", { p_pseudo: pseudo });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Creates or changes the profile. The database words its own refusals —
 * « Ce pseudo existe déjà » when somebody took it a second earlier — so its
 * message is passed on as it is.
 */
export async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await supabase().rpc("save_profile", {
    p_pseudo: profile.pseudo,
    p_avatar: profile.avatar,
  });
  if (error) throw new Error(error.message);
}

/** Deletes the account for good, then lets go of the session it leaves behind. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase().rpc("delete_account");
  if (error) throw new Error(error.message);
  // The user is gone, so the session is worth nothing; a refusal to revoke
  // it on the server changes nothing, and the local copy still has to go.
  await supabase().auth.signOut({ scope: "local" });
}

interface RawSeat {
  seat: number;
  account_id: string | null;
  name: string;
  pawn: number;
  from_turn: number;
}

interface RawGame {
  id: string;
  status: GameStatus;
  started_at: string;
  ended_at: string | null;
  turn_count: number;
  winner: number | null;
  final: GameState | null;
  seats: RawSeat[] | null;
}

const toSeat = (r: RawSeat): HistorySeat => ({
  seat: r.seat,
  accountId: r.account_id,
  name: r.name,
  pawn: r.pawn,
  fromTurn: r.from_turn,
});

const toGame = (r: RawGame): HistoryGame => ({
  id: r.id,
  status: r.status,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  turnCount: r.turn_count,
  winner: r.winner,
  final: r.final,
  seats: (r.seats ?? []).map(toSeat),
});

/** This account's most recent online games, newest first. */
export async function fetchMyGames(limit = 20): Promise<History> {
  const { data, error } = await supabase().rpc("get_my_games", { p_limit: limit });
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as { games?: RawGame[]; people?: Record<string, Person> };
  return { games: (raw.games ?? []).map(toGame), people: raw.people ?? {} };
}
