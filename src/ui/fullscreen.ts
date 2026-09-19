import { useCallback, useEffect, useState } from "react";
import { pushToast } from "../game/store";

/**
 * Orientation locking is not in every browser — Safari on iPhone has no such
 * thing, and where it does exist it only works from inside fullscreen.
 */
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

/** What actually happened when the page asked to fill the screen. */
export type LandscapeResult = "fullscreen" | "rotated" | "refused";

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
 * to landscape.
 *
 * Must be called from a user gesture, or the fullscreen request is denied.
 *
 * Both halves are attempted every time, and that is the whole point. The
 * fullscreen request used to be skipped whenever `document.fullscreenElement`
 * was set — but that flag is exactly what goes stale when Android collapses
 * fullscreen to show a permission prompt, so the page believed it was
 * already there and only took the orientation lock. The result was the
 * symptom: landscape, with the browser chrome back, and no way to return.
 * Re-requesting while genuinely fullscreen is a no-op, so asking anyway
 * costs nothing. And the lock used to sit behind an early `return`, so a
 * refused fullscreen meant the button did nothing whatsoever.
 */
export async function enterLandscape(): Promise<LandscapeResult> {
  let full = false;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    full = true;
  } catch {
    // Refused, or already there and the browser objected to being asked.
    full = document.fullscreenElement !== null;
  }

  let rotated = false;
  try {
    await orientationApi()?.lock?.("landscape");
    rotated = true;
  } catch {
    // No lock here; the player turns the device themselves.
  }

  if (full) return "fullscreen";
  return rotated ? "rotated" : "refused";
}

/** Leave fullscreen and release any orientation lock taken with it. */
export async function leaveFullscreen(): Promise<void> {
  try {
    orientationApi()?.unlock?.();
  } catch {
    // Nothing was locked.
  }
  try {
    // Asked for without checking `fullscreenElement`, for the same reason
    // the request above is: the flag is not to be trusted, and exiting when
    // there is nothing to exit merely rejects.
    await document.exitFullscreen();
  } catch {
    // Already out, or the browser declined; either way there is nothing to do.
  }
}

/**
 * Puts the page back into fullscreen at the first touch after something took
 * it away.
 *
 * Android drops fullscreen to show the microphone prompt, and by the time
 * the prompt is answered the gesture that opened it is long spent — nothing
 * may request fullscreen again until the player touches the screen. So the
 * page waits for that touch instead of leaving them to go and find the
 * setting, which is where this stopped working before.
 */
export function restoreFullscreenOnNextTouch(): void {
  if (!fullscreenSupported() || document.fullscreenElement) return;

  const stop = (): void => {
    window.removeEventListener("pointerdown", once, true);
    clearTimeout(timer);
  };
  const once = (): void => {
    stop();
    void enterLandscape();
  };
  // Captured so it runs whatever the touch lands on, and not preventable:
  // the tap still does whatever the player meant it to do.
  window.addEventListener("pointerdown", once, true);
  // Not armed for ever — a tap a minute later is not somebody trying to get
  // their screen back, and stealing it then would be startling.
  const timer = setTimeout(stop, 25_000);

  pushToast("Touchez l'écran pour revenir au plein écran", "info");
}

/**
 * Runs something that may cost the page its fullscreen — a permission prompt
 * — and arranges to get it back.
 *
 * The work itself knows nothing about any of this: asking for a microphone
 * is the network layer's business, and fullscreen is the interface's.
 */
export async function keepingFullscreen<T>(run: () => Promise<T>): Promise<T> {
  const was = document.fullscreenElement !== null;
  try {
    return await run();
  } finally {
    if (was && document.fullscreenElement === null) restoreFullscreenOnNextTouch();
  }
}

interface FullscreenControl {
  active: boolean;
  supported: boolean;
  toggle: () => void;
}

/** Fullscreen state, kept in step with the Escape key and the system UI. */
export function useFullscreen(): FullscreenControl {
  const [active, setActive] = useState(
    () => typeof document !== "undefined" && document.fullscreenElement !== null,
  );

  useEffect(() => {
    const sync = (): void => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    // Android does not always announce the fullscreen it takes away for a
    // permission prompt, but the window does resize and the tab does lose
    // visibility. Listening to those as well stops the button claiming the
    // page is fullscreen when it plainly is not.
    window.addEventListener("resize", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void leaveFullscreen();
      return;
    }
    void enterLandscape().then((result) => {
      if (result === "refused") {
        pushToast("Le navigateur a refusé le plein écran", "bad");
      }
    });
  }, []);

  return { active, supported: fullscreenSupported(), toggle };
}
