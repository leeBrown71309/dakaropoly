import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../game/store";
import type { Toast } from "../../game/store";
import { useCompact } from "../useViewport";
import { Icon, type IconName } from "../icons/Icon";

const TONE: Record<Toast["tone"], { edge: string; icon: IconName; ink: string }> = {
  good: { edge: "#1E6F6B", icon: "coins", ink: "#12494A" },
  bad: { edge: "#8E4526", icon: "warning", ink: "#8E4526" },
  info: { edge: "#6B6152", icon: "receipt", ink: "#3A342B" },
};

/** Slips of paper pinned to the corner of the table as things happen. */
export function Toasts() {
  const allToasts = useGame((s) => s.toasts);
  const compact = useCompact();
  // A short screen has room for three slips between the rail and the bank
  // cards; past that the stack would run up over the players.
  const toasts = compact ? allToasts.slice(-3) : allToasts;

  return (
    <div
      className={`pointer-events-none absolute z-40 flex flex-col-reverse items-start gap-1.5 ${
        compact ? "bottom-[54px] left-1.5 w-[210px]" : "bottom-24 left-3 w-[264px]"
      }`}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t, i) => {
          const tone = TONE[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: -26, rotate: -3 }}
              animate={{ opacity: 1, x: 0, rotate: i % 2 === 0 ? -0.7 : 0.6 }}
              exit={{ opacity: 0, x: -18, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={`mat-grain relative flex items-start gap-2 ${
                compact ? "py-1 pl-2 pr-2" : "py-1.5 pl-2.5 pr-3"
              }`}
              style={{
                background: "linear-gradient(176deg,#fdfaf2,#f0e7d3)",
                borderLeft: `3px solid ${tone.edge}`,
                boxShadow: "0 10px 22px -10px rgba(52,33,12,.6), 0 2px 5px -2px rgba(52,33,12,.4)",
              }}
            >
              <Icon
                name={tone.icon}
                size={compact ? 12 : 14}
                className="mt-[1px] shrink-0"
                style={{ color: tone.edge }}
              />
              <span
                className={`font-semibold leading-snug ${compact ? "text-[10.5px]" : "text-[12px]"}`}
                style={{ color: tone.ink }}
              >
                {t.text}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
