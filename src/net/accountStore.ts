import { create } from "zustand";
import { onlineAvailable, supabase } from "./supabase";
import {
  deleteAccount,
  fetchMyProfile,
  saveProfile,
  signInWithGoogle,
  signOut,
  type Profile,
} from "./account";
import { useRoom } from "./roomStore";

/**
 * Who is holding this tab: a guest, or an account.
 *
 * - `unavailable` — no online configuration in this build, so no accounts.
 * - `loading` — not known yet, or the profile could not be read (`error`
 *   says why, and `refresh` tries again).
 * - `guest` — the anonymous identity every tab gets. Everything works.
 * - `needs-profile` — signed in with Google but no pseudo chosen yet. Not an
 *   account until it has one: the table needs a name to call it by.
 * - `ready` — an account, with its profile.
 */
export type AccountStatus = "unavailable" | "loading" | "guest" | "needs-profile" | "ready";

interface AccountState {
  status: AccountStatus;
  profile: Profile | null;
  /** The Google account's own name and photo, offered when the profile is made. */
  googleName: string | null;
  googlePhoto: string | null;
  busy: boolean;
  error: string | null;

  /** Reads the session and the profile again; also the retry after a failure. */
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Saves the profile; reports whether it was taken. */
  save: (profile: Profile) => Promise<boolean>;
  /** Deletes the account for good. */
  remove: () => Promise<void>;
  clearError: () => void;
}

const message = (e: unknown): string =>
  e instanceof Error ? e.message : "Quelque chose n'a pas marché";

/**
 * Signing in and out changes the identity that holds a chair, so neither is
 * allowed from inside a room — a guest seated at a table would get up as
 * somebody the room has never heard of.
 */
function refuseInRoom(): string | null {
  return useRoom.getState().code ? "Quittez le salon avant de changer de compte" : null;
}

/**
 * Answers from an older `refresh` are dropped. Sign-in, the first read and a
 * notice from another tab can all land at once, and the slowest one must not
 * put back a state the others have already moved past.
 */
let generation = 0;

export const useAccount = create<AccountState>()((set, get) => ({
  status: onlineAvailable ? "loading" : "unavailable",
  profile: null,
  googleName: null,
  googlePhoto: null,
  busy: false,
  error: null,

  clearError: () => set({ error: null }),

  refresh: async () => {
    if (!onlineAvailable) return;
    const mine = ++generation;
    // This tab's view of the session, read from storage — not the session an
    // auth event carries, which may be another tab's sign-in arriving over
    // the broadcast channel (see `authStorage`).
    const { data, error } = await supabase().auth.getSession();
    if (mine !== generation) return;
    const user = data.session?.user;
    if (error || !user || user.is_anonymous !== false) {
      set({ status: "guest", profile: null, googleName: null, googlePhoto: null });
      return;
    }

    const meta = user.user_metadata as Record<string, unknown>;
    const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
    set({
      googleName: text(meta.full_name) ?? text(meta.name),
      googlePhoto: text(meta.avatar_url) ?? text(meta.picture),
    });
    try {
      const profile = await fetchMyProfile();
      if (mine !== generation) return;
      set({ status: profile ? "ready" : "needs-profile", profile, error: null });
    } catch (e) {
      if (mine !== generation) return;
      set({ status: "loading", error: `Profil injoignable : ${message(e)}` });
    }
  },

  signIn: async () => {
    const refused = refuseInRoom();
    if (refused) return set({ error: refused });
    set({ busy: true, error: null });
    try {
      await signInWithGoogle();
      // The page is on its way to Google; `busy` stays up until it has gone.
    } catch (e) {
      set({ busy: false, error: message(e) });
    }
  },

  signOut: async () => {
    const refused = refuseInRoom();
    if (refused) return set({ error: refused });
    set({ busy: true, error: null });
    try {
      await signOut();
      await get().refresh();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  save: async (profile) => {
    set({ busy: true, error: null });
    try {
      await saveProfile(profile);
      set({ status: "ready", profile });
      return true;
    } catch (e) {
      set({ error: message(e) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  remove: async () => {
    const refused = refuseInRoom();
    if (refused) return set({ error: refused });
    set({ busy: true, error: null });
    try {
      await deleteAccount();
      await get().refresh();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },
}));

/** The query parameters Google's round trip leaves on the page. */
const OAUTH_PARAMS = ["code", "error", "error_code", "error_description"];

/**
 * Starts following the session: once now, then on every sign-in and
 * sign-out — this tab's, or another's in the same browser.
 *
 * Also tidies the address bar after the return from Google. The code in it
 * has been spent by then, and a refused sign-in says why in the same place,
 * which is the one moment the player can be told.
 */
export function initAccount(): void {
  if (!onlineAvailable) return;

  const params = new URLSearchParams(location.search);
  const refused = params.get("error_description");

  supabase().auth.onAuthStateChange((event) => {
    if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
    // Deferred: the auth client holds a lock while it notifies, and calling
    // back into it from inside the callback waits on that same lock.
    setTimeout(() => void useAccount.getState().refresh(), 0);
  });

  void useAccount
    .getState()
    .refresh()
    .then(() => {
      if (!OAUTH_PARAMS.some((p) => params.has(p))) return;
      for (const p of OAUTH_PARAMS) params.delete(p);
      const rest = params.toString();
      history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}`);
      if (refused) useAccount.setState({ error: `Google a refusé la connexion : ${refused}` });
    });
}
