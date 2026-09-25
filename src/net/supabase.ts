import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthStorage } from "./authStorage";

/**
 * The Supabase connection, created once and only when the online mode is
 * actually used. A build without the two environment variables still works
 * perfectly as a hot-seat game — `onlineAvailable` is what the home screen
 * checks before offering to play over the network.
 *
 * The key is published with the site on purpose. It grants nothing on its
 * own: rooms cannot be read from the table at all, only through functions
 * that demand the room code, so the code is the real key.
 */
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_KEY;

export const onlineAvailable = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    if (!URL || !KEY) throw new Error("Mode en ligne non configuré");
    client = createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /*
         * A guest per tab, an account per browser — see `authStorage`.
         *
         * Local storage alone made two windows side by side the *same*
         * player, and the second silently took over the first one's seat.
         * Session storage alone signed an account out every time its tab
         * closed. Each kind of session goes where its owner lives.
         */
        storage: createAuthStorage(sessionStorage, localStorage),
        // Google hands back a code on the redirect, exchanged here for the
        // session; the verifier waits out the round trip in the tab.
        flowType: "pkce",
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

/**
 * Establishes an identity for this device, signing in anonymously if needed.
 *
 * Nobody types anything — this is not the login. It exists so the database
 * can tell one device from another and refuse to let anyone edit a seat that
 * is not theirs. A player signed in with Google already has an identity, and
 * it is the one that sits down.
 */
export async function ensureSession(): Promise<string> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (!error && signed.user) return signed.user.id;

  // Without an identity there is no way to tell players apart, and every
  // write would be refused. Failing here with the reason beats failing later
  // with a row level security error nobody can interpret.
  throw new Error(
    "Connexion impossible. Activez « Anonymous Sign-Ins » dans le projet Supabase (Authentication → Providers).",
  );
}
