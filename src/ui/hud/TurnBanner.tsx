import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { Money } from "../kit/Money";
import { PawnGlyph } from "../icons/PawnGlyph";
import { Icon } from "../icons/Icon";

/**
 * A shop sign bolted to the top edge of the screen. It swings down into
 * place on each change of turn rather than fading in.
 */
export function TurnBanner() {
  const game = useGame((s) => s.game);
  const compact = useCompact();
  if (!game || game.phase === "game-over") return null;
  const player = game.players[game.current];
  if (!player) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2"
      style={{ perspective: 700 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${game.turnCount}-${player.id}`}
          initial={{ rotateX: -78, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 34, opacity: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 18 }}
          style={{ transformOrigin: "top center" }}
          className={`mat-wood mat-grain flex items-center rounded-t-none ${
            compact ? "gap-2 px-3 pb-1.5 pt-2" : "gap-3 px-5 pb-2.5 pt-3"
          }`}
        >
          <span className="mat-brass absolute inset-x-0 bottom-0 h-[2px]" />
          {/* Mounting screws */}
          {!compact && (
            <>
              <span className="mat-brass absolute left-2.5 top-1.5 h-1.5 w-1.5 rounded-full" />
              <span className="mat-brass absolute right-2.5 top-1.5 h-1.5 w-1.5 rounded-full" />
            </>
          )}

          <span style={{ color: player.color }}>
            <PawnGlyph pawn={player.pawn} size={compact ? 17 : 24} />
          </span>
          <span
            className={`u-display leading-none text-sand-100 ${compact ? "text-[12px]" : "text-[16px]"}`}
          >
            {compact ? player.name : `Au tour de ${player.name}`}
          </span>
          {player.inJail && <Icon name="jail" size={compact ? 12 : 15} className="text-clay-300" />}
          <span className={`w-px bg-black/35 ${compact ? "h-3" : "h-4"}`} />
          <Money
            amount={player.money}
            className={`font-bold leading-none text-gold-300 ${compact ? "text-[11px]" : "text-[14px]"}`}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Banknotes thrown across the screen when a large sum lands. */
export function MoneyRain() {
  const rainKey = useGame((s) => s.rainKey);
  if (rainKey === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" key={rainKey}>
      {Array.from({ length: 22 }).map((_, i) => {
        const drift = (i % 5) - 2;
        return (
          <motion.div
            key={i}
            initial={{ y: -60, x: `${(i * 4.4 + 3) % 98}vw`, rotate: i * 37, opacity: 0 }}
            animate={{
              y: "112vh",
              rotate: i * 37 + 420 + drift * 90,
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 1.7 + (i % 5) * 0.18, delay: (i % 7) * 0.06, ease: "easeIn" }}
            className="absolute text-gold-500"
            style={{ filter: "drop-shadow(0 3px 5px rgba(40,25,8,.45))" }}
          >
            <Icon name="banknote" size={30} strokeWidth={1.5} />
          </motion.div>
        );
      })}
    </div>
  );
}
