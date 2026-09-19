import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
         * Per tab, not per browser.
         *
         * Local storage is shared by every tab of the same browser, so two
         * windows opened side by side would be the *same* player and the
         * second would silently take over the first one's seat. That is not
         * only a testing nuisance: two tabs is how anyone tries this out
         * before a real game. Session storage survives a reload, which is
         * what a player needs, and gives each tab its own identity, which is
         * what a tester needs.
         *
         * The cost is that closing a tab loses the seat until reclaiming one
         * is built.
         */
        storage: sessionStorage,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

/**
 * Establishes an identity for this device, signing in anonymously if needed.
 *
 * Nobody types anything — this is not a login. It exists so the database can
 * tell one device from another and refuse to let anyone edit a seat that is
 * not theirs.
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
