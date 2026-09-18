import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase connection, created once and only when the online mode is
 * actually used. A build without the two environment variables still works
 * perfectly as a hot-seat game — `onlineAvailable` is what the home screen
 * checks before offering to play over the network.
 *
 * The key is published with the site on purpose. It grants nothing on its
 * own: every table is behind row level security, so what a visitor can read
 * or write is decided by the policies, not by holding the key.
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
        // Per tab, not per browser — see `localId` below for why.
        storage: sessionStorage,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

const LOCAL_ID_KEY = "dakaropoly/client";

/** Whether the last session came from Supabase auth rather than the fallback. */
export let seatsAreEnforced = false;

/**
 * A player id that belongs to the tab rather than to the browser.
 *
 * Local storage would be shared by every tab of the same browser, so two
 * windows opened side by side would be the *same* player — the second would
 * silently take over the first one's seat. That is not just a testing
 * inconvenience: it is the only way anyone tries this out before a real game.
 * Session storage survives a reload, which is what a player actually needs,
 * and gives each tab its own identity, which is what a tester needs.
 *
 * The cost is that closing the tab loses the seat. Reclaiming an abandoned
 * seat is part of the reconnection work, not of this step.
 */
function localId(): string {
  let id = sessionStorage.getItem(LOCAL_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(LOCAL_ID_KEY, id);
  }
  return id;
}

/**
 * Establishes a stable id for this device.
 *
 * This is not a login — nobody types anything. It exists so the database can
 * tell one device from another and refuse to let someone edit a seat that is
 * not theirs. The session is kept in local storage, so reopening the page
 * comes back as the same player.
 *
 * Anonymous sign-ins are a project setting that may be off, and a game among
 * friends should not fall over because of a switch in a dashboard. When they
 * are unavailable the id is generated here instead and seat ownership becomes
 * a convention rather than a rule — everything still works, and turning the
 * setting on upgrades it with no code change.
 */
export async function ensureSession(): Promise<string> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user.id) {
    seatsAreEnforced = true;
    return data.session.user.id;
  }

  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (!error && signed.user) {
    seatsAreEnforced = true;
    return signed.user.id;
  }

  seatsAreEnforced = false;
  return localId();
}
