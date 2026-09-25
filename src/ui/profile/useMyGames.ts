import { useCallback, useEffect, useState } from "react";
import { fetchMyGames } from "../../net/account";
import type { History } from "../../net/history";

export interface MyGames {
  history: History | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * The account's recent games, read once when the profile opens. Not kept
 * in a store: the history is only ever looked at here, and a game finished
 * since should simply be there the next time the screen is opened.
 */
export function useMyGames(enabled: boolean): MyGames {
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setLoading(true);
    setError(null);
    fetchMyGames()
      .then((h) => live && setHistory(h))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Historique injoignable"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { history, loading, error, reload };
}
