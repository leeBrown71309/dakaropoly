import { motion, AnimatePresence } from "framer-motion";
import { useGame, type Announcement as AnnouncementData } from "../../game/store";
import type { AnnounceKind } from "../../game/types";
import { useCompact } from "../useViewport";
import { Money } from "../kit/Money";
import { Icon, type IconName } from "../icons/Icon";

interface Style {
  icon: IconName;
  band: string;
  ink: string;
  label: string;
}

const STYLE: Record<AnnounceKind, Style> = {
  tax: { icon: "coins", band: "#8E4526", ink: "#FBEDEB", label: "Prélèvement" },
  jail: { icon: "jail", band: "#3A342B", ink: "#F5EDDD", label: "Police" },
  rent: { icon: "banknote", band: "#1E6F6B", ink: "#EAFAF6", label: "Loyer dû" },
  bankruptcy: { icon: "flag", band: "#6F3319", ink: "#FDEEE6", label: "Fin de parcours" },
};

/**
 * Things that happen *to* a player — tax, rent, a trip to Rebeuss, a
 * bankruptcy — are dealt onto the table as a card and clear themselves. A
 * toast alone was too easy to miss while watching the board.
 */
export function Announcement() {
  const announcement = useGame((s) => s.announcement);
  const compact = useCompact();

  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[45] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background:
              "radial-gradient(70% 50% at 50% 50%, rgba(30,18,6,.34) 0%, rgba(16,10,3,.52) 100%)",
          }}
        >
          <motion.div
            initial={{ y: -90, rotate: -7, scale: 0.86, opacity: 0 }}
            animate={{ y: 0, rotate: -1, scale: 1, opacity: 1 }}
            exit={{ y: 40, rotate: 5, scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className={`mat-card mat-grain overflow-hidden ${compact ? "w-[266px]" : "w-[330px]"}`}
          >
            <Header announcement={announcement} compact={compact} />
            <div className={`text-center ${compact ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-3"}`}>
              <p className={`leading-snug text-ink-700 ${compact ? "text-[11.5px]" : "text-[13px]"}`}>
                {announcement.detail}
              </p>
              {announcement.amount !== undefined && (
                <div className={compact ? "mt-1.5" : "mt-2.5"}>
                  <Money
                    amount={-announcement.amount}
                    signed
                    className={`u-display leading-none text-clay-700 ${
                      compact ? "text-[24px]" : "text-[32px]"
                    }`}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({ announcement, compact }: { announcement: AnnouncementData; compact: boolean }) {
  const style = STYLE[announcement.kind];
  return (
    <div
      className={`flex items-center gap-2.5 ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}
      style={{
        backgroundColor: style.band,
        color: style.ink,
        boxShadow: "inset 0 -2px 6px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.18)",
      }}
    >
      <Icon name={style.icon} size={compact ? 16 : 20} strokeWidth={1.6} />
      <span className="min-w-0">
        <span className="u-label block opacity-70">{style.label}</span>
        <span
          className={`u-display block truncate leading-tight ${compact ? "text-[13px]" : "text-[16px]"}`}
        >
          {announcement.title}
        </span>
      </span>
    </div>
  );
}
