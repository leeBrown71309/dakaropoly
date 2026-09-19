import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useCompact } from "../useViewport";

/** Clearance between the slip and the control it belongs to. */
const GAP = 8;
/** Kept off the glass edges, on top of whatever the notch already takes. */
const EDGE = 10;
/** Headroom a slip needs above a control before it gives up and hangs below. */
const ROOM = 120;
/** How long a slip a finger opened stays before seeing itself out. */
const TOUCH_DWELL = 4500;

/**
 * Where the slip sits, as edges rather than an offset.
 *
 * Anchoring the bottom edge rather than translating the top one is not a
 * style choice: the slip is a `motion.div`, and its entrance animates
 * `transform` — any `translateY` written here is overwritten the moment it
 * mounts, which drops the slip straight on top of the control it explains.
 */
interface Placement {
  left: number;
  /** Set when hanging below the control; `bottom` is set instead when above. */
  top?: number;
  bottom?: number;
  below: boolean;
  /** Opened by a finger, so nothing will ever arrive to close it. */
  byTouch: boolean;
}

/**
 * The glass a slip may occupy: the viewport, less the notch.
 *
 * Held in landscape — the only way this board is playable — a phone puts its
 * notch on one of the *sides*, which is exactly where the panels carrying
 * these controls sit. The rest of the interface clears it through `.p-safe`;
 * a slip is portalled to `body`, outside that wrapper, so it has to read the
 * insets for itself.
 */
function safeBox(): { left: number; right: number; top: number } {
  const root = getComputedStyle(document.documentElement);
  const inset = (name: string) => parseFloat(root.getPropertyValue(name)) || 0;
  return {
    left: inset("--safe-l") + EDGE,
    right: window.innerWidth - inset("--safe-r") - EDGE,
    top: inset("--safe-t") + EDGE,
  };
}

interface TooltipProps {
  /** The short verdict, set in the display serif. */
  title: string;
  /** The rule behind it, in a sentence. Omit for a plain label. */
  detail?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A printed slip explaining a control.
 *
 * It exists because the interface used to answer a refused move with two or
 * three words in a browser tooltip — "Groupe incomplet" — which is a verdict,
 * not a reason, and which a phone never shows at all.
 *
 * It is positioned against the viewport rather than the anchor's parent: the
 * controls that most need one sit inside a panel that scrolls, and a slip
 * clipped by its own list would be worse than none. Anything that moves the
 * anchor underneath it — a scroll, a resize — closes it rather than leaving
 * it pointing at nothing.
 */
export function Tooltip({ title, detail, children, className = "" }: TooltipProps) {
  const compact = useCompact();
  const anchor = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const id = useId();
  const width = compact ? 206 : 244;

  const close = useCallback(() => setPlace(null), []);

  const open = useCallback(
    (byTouch: boolean) => {
      const el = anchor.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const box = safeBox();
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, box.left),
        Math.max(box.left, box.right - width),
      );
      // Above by default — a slip under the thumb is a slip nobody reads. It
      // flips below only when there is genuinely no headroom, which on a
      // phone in landscape is most of the top half of the glass.
      const below = rect.top - box.top < ROOM;
      setPlace({
        left,
        below,
        byTouch,
        top: below ? rect.bottom + GAP : undefined,
        bottom: below ? undefined : window.innerHeight - rect.top + GAP,
      });
    },
    [width],
  );

  useEffect(() => {
    if (!place) return;
    const dismiss = (e: Event) => {
      if (e.type === "pointerdown" && anchor.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("pointerdown", dismiss, true);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("pointerdown", dismiss, true);
    };
  }, [place, close]);

  useEffect(() => {
    // A finger leaves nothing behind it: there is no pointerleave coming, and
    // waiting for a tap somewhere else would leave the slip sitting over the
    // board for the rest of the turn.
    if (!place?.byTouch) return;
    const t = window.setTimeout(close, TOUCH_DWELL);
    return () => window.clearTimeout(t);
  }, [place, close]);

  return (
    <>
      <span
        ref={anchor}
        // `tip-anchor` takes the pointer events away from a disabled child:
        // a disabled button swallows them outright, so without it the one
        // control that most needs explaining is the one that cannot be
        // hovered at all.
        className={`tip-anchor ${className}`}
        aria-describedby={place ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") open(false);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") close();
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          // On a control that still works, the tap *is* the action, and a
          // slip explaining it afterwards would hang over a board that has
          // already moved on. A refused control takes no pointer events, so
          // the tap lands on this wrapper instead — which is exactly the
          // case worth a word.
          if (e.target !== anchor.current) return;
          if (place) close();
          else open(true);
        }}
        onFocus={() => open(false)}
        onBlur={close}
      >
        {children}
      </span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {place && (
              <motion.div
                id={id}
                role="tooltip"
                // Nothing here takes pointer events: a slip that follows the
                // cursor onto itself is a slip that never closes.
                className="pointer-events-none fixed z-[110]"
                style={{ left: place.left, top: place.top, bottom: place.bottom, width }}
                initial={{ opacity: 0, y: place.below ? -4 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: place.below ? -4 : 4 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
              >
                <div className="tip-slip">
                  <div className={`u-display leading-tight ${compact ? "text-[12px]" : "text-[13px]"}`}>
                    {title}
                  </div>
                  {detail && (
                    <p
                      className={`mt-1 leading-snug text-ink-700 ${
                        compact ? "text-[10.5px]" : "text-[11.5px]"
                      }`}
                    >
                      {detail}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
