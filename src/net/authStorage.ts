/**
 * Where the auth client keeps a session — which depends on whose it is.
 *
 * A guest's session is the tab's own, in `sessionStorage`: two windows side
 * by side must be two players, or the second silently takes over the first
 * one's chair, and two tabs is how anyone tries this before a real game. An
 * account's session is the person's, in `localStorage`: signing in with
 * Google and being signed out again by closing the tab would make the
 * account worth nothing.
 *
 * Reading asks the tab first. A tab that was already seated as a guest when
 * somebody signed in elsewhere in the same browser keeps its guest identity,
 * and with it its chair: an account arriving in `localStorage` must never
 * swap the identity out from under a game in progress. A fresh tab has
 * nothing of its own, and reads the account.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Whether a stored value is a signed-in account's session. Everything else
 * the auth client writes — a guest's session, a PKCE verifier waiting out
 * the redirect to Google — belongs to the tab that wrote it.
 */
export function isAccountSession(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as { user?: { is_anonymous?: unknown } } | null;
    return parsed?.user?.is_anonymous === false;
  } catch {
    return false;
  }
}

export function createAuthStorage(tab: KeyValueStore, browser: KeyValueStore): KeyValueStore {
  return {
    getItem: (key) => tab.getItem(key) ?? browser.getItem(key),
    setItem: (key, value) => {
      if (isAccountSession(value)) {
        browser.setItem(key, value);
        // The guest session this tab held until the account arrived would
        // otherwise go on shadowing it on every read.
        tab.removeItem(key);
      } else {
        tab.setItem(key, value);
      }
    },
    // Removed from wherever the value was read, and only there. A guest tab
    // whose session lapses must not sign the account out of every other tab.
    removeItem: (key) => {
      if (tab.getItem(key) !== null) tab.removeItem(key);
      else browser.removeItem(key);
    },
  };
}
