import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { BOARD } from "../../game/data/board";
import { formatMoney, type TileDef } from "../../game/types";

export function BuyPanel() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  if (!game || game.phase !== "buy-decision" || game.buyTile === null) return null;
  const tile = BOARD[game.buyTile] as TileDef | undefined;
  const price = tile?.price ?? 0;
  const player = game.players[game.current];
  const preview =
    tile?.kind === "station"
      ? "25 F (1 gare)"
      : tile?.kind === "utility"
        ? "4 × dés"
        : `${tile?.rents?.[0] ?? 0} F`;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-28 left-1/2 z-30 w-[340px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#101a2b]/92 p-4 backdrop-blur-md"
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-100">{tile?.name}</h3>
        <span className="text-sm font-bold text-amber-300">{formatMoney(price)}</span>
      </div>
      <p className="mb-3 text-sm text-slate-400">Loyer de base : {preview}</p>
      <div className="flex gap-2">
        <button
          disabled={(player?.money ?? 0) < price}
          onClick={() => dispatch({ t: "buy" })}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
        >
          Acheter
        </button>
        <button
          onClick={() => dispatch({ t: "decline" })}
          className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-slate-200 transition hover:bg-white/20"
        >
          Refuser (enchères)
        </button>
      </div>
    </motion.div>
  );
}
