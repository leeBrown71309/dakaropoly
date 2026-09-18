import { useCallback, useSyncExternalStore } from "react";

/**
 * The two viewport questions the interface asks.
 *
 * `COMPACT_QUERY` is the dense HUD: a phone held in landscape is barely 400
 * CSS pixels tall, so every panel, rail and card has a smaller variant behind
 * this flag. It also catches a short or narrow desktop window, which wants
 * the same treatment.
 *
 * `PORTRAIT_QUERY` is the case the board cannot be played in at all — a phone
 * or small tablet held upright. It is deliberately limited to coarse
 * pointers: a narrow desktop window should get the compact layout, never a
 * "rotate your device" wall it cannot obey.
 */
const COMPACT_QUERY = "(max-height: 520px), (max-width: 760px)";
const PORTRAIT_QUERY = "(orientation: portrait) and (max-width: 900px) and (pointer: coarse)";

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True while the HUD must run in its dense variant. */
export function useCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

/** True while the device is held upright and the board is unplayable. */
export function usePortraitBlocked(): boolean {
  return useMediaQuery(PORTRAIT_QUERY);
}
