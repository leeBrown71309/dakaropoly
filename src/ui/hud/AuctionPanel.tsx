import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { BOARD } from "../../game/data/board";
import { formatMoney } from "../../game/types";

const RAISES = [10, 50, 100];

export function AuctionPanel() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  if (!game || game.phase !== "auction" || !game.auction) return null;
  const a = game.auction;
  const tile = BOARD[a.pos];
  const bidder = game.players[a.order[0] ?? -1];
  const winner = a.highBidder !== null ? game.players[a.highBidder] : null;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-28 left-1/2 z-30 w-[380px] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-[#101a2b]/93 p-4 backdrop-blur-md"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-100">🔨 Enchères — {tile?.name}</h3>
        {winner && (
          <span className="text-sm font-bold" style={{ color: winner.color }}>
            Meilleure : {winner.name} ({a.highBid} F)
          </span>
        )}
      </div>
      {bidder ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-300">
            C'est le tour de{" "}
            <span className="font-bold" style={{ color: bidder.color }}>
              {bidder.name}
            </span>{" "}
            (a {formatMoney(bidder.money)})
          </p>
          <div className="flex gap-2">
            {RAISES.map((r) => {
              const next = a.highBid === 0 ? r : a.highBid + r;
              return (
                <button
                  key={r}
                  disabled={next > bidder.money}
                  onClick={() => dispatch({ t: "bid", amount: next })}
                  className="flex-1 rounded-xl bg-amber-400 px-3 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300 disabled:opacity-30"
                >
                  +{r} → {next} F
                </button>
              );
            })}
            <button
              onClick={() => dispatch({ t: "auction-pass" })}
              className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/20"
            >
              Se retirer
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Résolution…</p>
      )}
    </motion.div>
  );
}
