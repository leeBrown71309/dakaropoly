import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { formatMoney } from "../../game/types";

export function TurnBanner() {
  const game = useGame((s) => s.game);
  if (!game || game.phase === "game-over") return null;
  const player = game.players[game.current];
  if (!player) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${game.turnCount}-${player.id}`}
          initial={{ opacity: 0, y: -16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="flex items-center gap-2 rounded-full border px-5 py-2 shadow-lg backdrop-blur-md"
          style={{ borderColor: `${player.color}66`, backgroundColor: `${player.color}1c` }}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: player.color }} />
          <span className="font-bold text-slate-100">
            Au tour de {player.name}
            {player.inJail && " 🔒"}
          </span>
          <span className="text-sm text-slate-300">{formatMoney(player.money)}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function MoneyRain() {
  const rainKey = useGame((s) => s.rainKey);
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" key={rainKey}>
      {rainKey > 0 &&
        Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -40, x: `${(i * 4.2) % 100}%`, opacity: 0, rotate: Math.random() * 90 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: Math.random() * 360 }}
            transition={{ duration: 1.6 + Math.random(), delay: Math.random() * 0.4, ease: "easeIn" }}
            className="absolute text-2xl"
          >
            💵
          </motion.div>
        ))}
    </div>
  );
}
