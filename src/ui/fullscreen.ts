import { useCallback, useEffect, useState } from "react";

/**
 * Orientation locking is not in every browser — Safari on iOS has no such
 * thing, and where it does exist it only works from inside fullscreen.
 */
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

/** Whether the browser will let the page go fullscreen at all. */
export function fullscreenSupported(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled;
}

function orientationApi(): LockableOrientation | null {
  if (typeof screen === "undefined") return null;
  return (screen.orientation as LockableOrientation | undefined) ?? null;
}

/**
 * Reclaim the browser chrome and, where the browser allows it, pin the page
 * to landscape. Both calls are best-effort: a refusal is the normal outcome
 * on iOS, and the rotate gate is what covers that case.
 *
 * Must be called from a user gesture, or the fullscreen request is denied.
 */
export async function enterLandscape(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    return; // Refused — there is nothing sensible to fall back to.
  }

  try {
    await orientationApi()?.lock?.("landscape");
  } catch {
    // No orientation lock here; the player rotates the device themselves.
  }
}

/** Leave fullscreen and release any orientation lock taken with it. */
export async function leaveFullscreen(): Promise<void> {
  orientationApi()?.unlock?.();
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // Already out, or the browser declined; either way there is nothing to do.
  }
}

interface FullscreenControl {
  active: boolean;
  supported: boolean;
  toggle: () => void;
}

/** Fullscreen state, kept in step with the Escape key and the system UI. */
export function useFullscreen(): FullscreenControl {
  const [active, setActive] = useState(() => typeof document !== "undefined" && document.fullscreenElement !== null);

  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(() => {
    void (document.fullscreenElement ? leaveFullscreen() : enterLandscape());
  }, []);

  return { active, supported: fullscreenSupported(), toggle };
}
